use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Cache for the usage API response to avoid rate limiting.
/// Only refresh every 60 seconds.
static USAGE_CACHE: Mutex<Option<(std::time::Instant, RateLimits)>> = Mutex::new(None);

// ---------- Public types sent to the frontend ----------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub installed: bool,
    pub current_session: Option<SessionInfo>,
    pub weekly: WeeklyData,
    pub rate_limits: RateLimits,
    pub projects: Vec<ProjectStats>,
    pub model_usage: HashMap<String, ModelTokens>,
    pub timeline: TimelineData,
    pub total_sessions: u64,
    pub total_messages: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimelineData {
    /// Daily activity for the last 365 days (for heatmap)
    pub daily_activity: Vec<HeatmapDay>,
    /// Daily token counts by model (for models timeline chart)
    pub daily_by_model: Vec<DailyModelTokens>,
    /// Number of days with any activity
    pub active_days: u64,
    /// Current consecutive day streak ending today
    pub current_streak: u64,
    /// Longest consecutive day streak ever
    pub longest_streak: u64,
    /// Hour of day with most activity (0-23)
    pub peak_hour: u32,
    /// Most-used model
    pub favorite_model: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapDay {
    pub date: String,
    pub count: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyModelTokens {
    pub date: String,
    pub tokens_by_model: HashMap<String, u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub name: String,
    pub path: String,
    pub total_messages: u64,
    pub total_tokens: u64,
    pub total_cost_usd: f64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub session_count: u64,
    pub last_active_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RateLimits {
    pub plan_name: String,
    /// Whether we got real data from the API (vs estimates)
    pub is_real: bool,
    /// Session utilization percentage (0-100)
    pub session_pct: f64,
    /// Seconds until session limit resets
    pub session_resets_in_secs: i64,
    /// Weekly utilization percentage (0-100)
    pub weekly_pct: f64,
    /// Seconds until weekly limit resets
    pub weekly_resets_in_secs: i64,
    /// ISO timestamp of next weekly reset
    pub weekly_resets_at: String,
}

/// Accumulates token counts by type for cost calculation
#[derive(Debug, Default, Clone)]
struct TokenAccum {
    input: u64,
    output: u64,
    cache_read: u64,
    cache_write: u64,
}

impl TokenAccum {
    fn total(&self) -> u64 {
        self.input + self.output + self.cache_read + self.cache_write
    }

    /// Estimate cost in USD using Opus API pricing.
    /// Opus: input $15/M, output $75/M, cache_read $1.50/M, cache_write $18.75/M
    fn estimated_cost_usd(&self) -> f64 {
        (self.input as f64 * 15.0
            + self.output as f64 * 75.0
            + self.cache_read as f64 * 1.5
            + self.cache_write as f64 * 18.75)
            / 1_000_000.0
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub project: String,
    pub started_at: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub message_count: u64,
    pub duration_ms: u64,
    pub model: String,
    /// Tokens consumed in the latest request (input + cache_read + cache_creation)
    pub context_tokens_used: u64,
    /// Model's context window size
    pub context_window: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyData {
    pub days: Vec<DailyActivity>,
    pub total_messages: u64,
    pub total_sessions: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cost_usd: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyActivity {
    pub date: String,
    pub message_count: u64,
    pub session_count: u64,
    pub tool_call_count: u64,
    pub tokens: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelTokens {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_read_input_tokens: u64,
    #[serde(default)]
    pub cache_creation_input_tokens: u64,
    #[serde(default)]
    pub web_search_requests: u64,
}

// ---------- Internal types ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatsCache {
    #[serde(default)]
    model_usage: HashMap<String, ModelTokens>,
    #[serde(default)]
    total_sessions: u64,
    #[serde(default)]
    total_messages: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionMeta {
    #[serde(default)]
    pid: u32,
    session_id: String,
    #[serde(default)]
    cwd: String,
    #[serde(default)]
    started_at: u64,
}

struct SessionUsageAccum {
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_creation_tokens: u64,
    message_count: u64,
    model: String,
    /// Context consumed in the most recent request
    latest_context: u64,
}

// Per-day accumulator used when scanning JSONL files
struct DayAccum {
    messages: u64,
    sessions: HashSet<String>,
    tool_calls: u64,
    tokens: u64,
    cost_accum: TokenAccum,
}

// ---------- Public functions ----------

pub fn claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

pub fn is_claude_installed() -> bool {
    claude_dir().is_some_and(|p| p.exists())
}

pub fn collect_usage_data() -> Result<UsageData, Box<dyn std::error::Error>> {
    let claude = claude_dir().ok_or("Cannot find home directory")?;

    if !claude.exists() {
        return Ok(UsageData {
            installed: false,
            current_session: None,
            weekly: empty_weekly(),
            rate_limits: empty_rate_limits(),
            projects: vec![],
            model_usage: HashMap::new(),
            timeline: empty_timeline(),
            total_sessions: 0,
            total_messages: 0,
        });
    }

    let stats = read_stats_cache(&claude);
    let current_session = find_active_session(&claude);
    let weekly = build_weekly_from_jsonl(&claude);
    let rate_limits = compute_rate_limits(&claude);
    let projects = collect_project_stats(&claude);
    let timeline = collect_timeline_data(&claude);

    Ok(UsageData {
        installed: true,
        current_session,
        weekly,
        rate_limits,
        projects,
        model_usage: stats.model_usage,
        timeline,
        total_sessions: stats.total_sessions,
        total_messages: stats.total_messages,
    })
}

// ---------- Internal helpers ----------

fn empty_weekly() -> WeeklyData {
    WeeklyData {
        days: vec![],
        total_messages: 0,
        total_sessions: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0.0,
    }
}

fn read_stats_cache(claude_dir: &PathBuf) -> StatsCache {
    let path = claude_dir.join("stats-cache.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or(StatsCache {
            model_usage: HashMap::new(),
            total_sessions: 0,
            total_messages: 0,
        })
}

fn find_active_session(claude_dir: &PathBuf) -> Option<SessionInfo> {
    let sessions_dir = claude_dir.join("sessions");
    if !sessions_dir.exists() {
        return None;
    }

    // Build sysinfo once for all PID checks
    let sys = sysinfo::System::new_all();

    let entries = fs::read_dir(&sessions_dir).ok()?;
    let mut active_sessions: Vec<SessionMeta> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(meta) = serde_json::from_str::<SessionMeta>(&content) {
                if sys.process(sysinfo::Pid::from_u32(meta.pid)).is_some() {
                    active_sessions.push(meta);
                }
            }
        }
    }

    active_sessions.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    let meta = active_sessions.first()?;

    let session_usage = parse_session_jsonl(claude_dir, &meta.session_id);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let project = meta
        .cwd
        .split(['/', '\\'])
        .last()
        .unwrap_or("Unknown")
        .to_string();

    let context_window = context_window_for_model(&session_usage.model);

    Some(SessionInfo {
        session_id: meta.session_id.clone(),
        project,
        started_at: meta.started_at,
        input_tokens: session_usage.input_tokens,
        output_tokens: session_usage.output_tokens,
        cache_read_tokens: session_usage.cache_read_tokens,
        cache_creation_tokens: session_usage.cache_creation_tokens,
        message_count: session_usage.message_count,
        duration_ms: now.saturating_sub(meta.started_at),
        model: session_usage.model,
        context_tokens_used: session_usage.latest_context,
        context_window,
    })
}

fn parse_session_jsonl(claude_dir: &PathBuf, session_id: &str) -> SessionUsageAccum {
    let mut accum = SessionUsageAccum {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        message_count: 0,
        model: String::new(),
        latest_context: 0,
    };

    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return accum;
    }

    let entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return accum,
    };

    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let jsonl_path = entry.path().join(format!("{}.jsonl", session_id));
        if !jsonl_path.exists() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&jsonl_path) {
            for line in content.lines() {
                accumulate_assistant_usage(line, &mut accum);
            }
        }
        break;
    }

    accum
}

fn accumulate_assistant_usage(line: &str, accum: &mut SessionUsageAccum) {
    let val: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return,
    };
    if val.get("type").and_then(|t| t.as_str()) != Some("assistant") {
        return;
    }
    let usage = match val.get("message").and_then(|m| m.get("usage")) {
        Some(u) => u,
        None => return,
    };

    let inp = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let out = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let cr = usage
        .get("cache_read_input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let cw = usage
        .get("cache_creation_input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    accum.input_tokens += inp;
    accum.output_tokens += out;
    accum.cache_read_tokens += cr;
    accum.cache_creation_tokens += cw;
    accum.message_count += 1;

    // The context consumed for THIS request = input + cache_read + cache_creation
    // This overwrites each time so we always have the latest
    accum.latest_context = inp + cr + cw;

    if let Some(model) = val
        .get("message")
        .and_then(|m| m.get("model"))
        .and_then(|m| m.as_str())
    {
        accum.model = model.to_string();
    }
}

/// Returns the context window size for a given model name.
fn context_window_for_model(model: &str) -> u64 {
    // Claude Code uses extended context (1M) for Opus when available
    if model.contains("opus") {
        // Check if it's the 1M variant (indicated by [1m] in model string or default for claude-opus-4-6)
        1_000_000
    } else if model.contains("sonnet") {
        200_000
    } else if model.contains("haiku") {
        200_000
    } else {
        200_000
    }
}

/// Build weekly data by scanning ALL JSONL files in projects/ that were
/// modified within the last 8 days. This works even when stats-cache.json
/// is stale (which it often is).
fn build_weekly_from_jsonl(claude_dir: &PathBuf) -> WeeklyData {
    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return empty_weekly();
    }

    let today = chrono::Local::now().date_naive();
    let week_ago = today - chrono::Duration::days(7);
    let week_ago_str = week_ago.format("%Y-%m-%d").to_string();

    // Cutoff for file mtime filter (8 days to be safe with timezones)
    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(8 * 24 * 3600);

    let mut day_map: HashMap<String, DayAccum> = HashMap::new();

    let project_entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return empty_weekly(),
    };

    for proj_entry in project_entries.flatten() {
        let proj_path = proj_entry.path();
        if !proj_path.is_dir() {
            continue;
        }

        let files = match fs::read_dir(&proj_path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for file_entry in files.flatten() {
            let path = file_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            // Skip files not modified recently
            let mtime = match path.metadata().and_then(|m| m.modified()) {
                Ok(t) => t,
                Err(_) => continue,
            };
            if mtime < cutoff {
                continue;
            }

            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for line in content.lines() {
                let val: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let timestamp = match val.get("timestamp").and_then(|t| t.as_str()) {
                    Some(t) => t,
                    None => continue,
                };

                // Extract date part (YYYY-MM-DD)
                let date = &timestamp[..10];
                if date < week_ago_str.as_str() {
                    continue;
                }

                let session_id = val
                    .get("sessionId")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();

                let entry_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");

                let day = day_map
                    .entry(date.to_string())
                    .or_insert_with(|| DayAccum {
                        messages: 0,
                        sessions: HashSet::new(),
                        tool_calls: 0,
                        tokens: 0,
                        cost_accum: TokenAccum::default(),
                    });

                if !session_id.is_empty() {
                    day.sessions.insert(session_id);
                }

                if entry_type == "assistant" {
                    if let Some(usage) = val.get("message").and_then(|m| m.get("usage")) {
                        let inp = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let out = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let cr = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        let cw = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        day.messages += 1;
                        day.tokens += inp + out;
                        day.cost_accum.input += inp;
                        day.cost_accum.output += out;
                        day.cost_accum.cache_read += cr;
                        day.cost_accum.cache_write += cw;
                    }
                }

                // Count tool_use content blocks as tool calls
                if entry_type == "assistant" {
                    if let Some(content) = val.get("message").and_then(|m| m.get("content")) {
                        if let Some(arr) = content.as_array() {
                            for block in arr {
                                if block.get("type").and_then(|t| t.as_str()) == Some("tool_use")
                                {
                                    day.tool_calls += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Build the 7-day array
    let mut days: Vec<DailyActivity> = Vec::new();
    let mut total_messages: u64 = 0;
    let mut total_sessions: u64 = 0;
    let mut total_tokens: u64 = 0;

    for i in 0..7 {
        let date = week_ago + chrono::Duration::days(i + 1);
        let date_str = date.format("%Y-%m-%d").to_string();

        let (msg, sess, tools, tok) = match day_map.get(&date_str) {
            Some(d) => (
                d.messages,
                d.sessions.len() as u64,
                d.tool_calls,
                d.tokens,
            ),
            None => (0, 0, 0, 0),
        };

        total_messages += msg;
        total_sessions += sess;
        total_tokens += tok;

        days.push(DailyActivity {
            date: date_str,
            message_count: msg,
            session_count: sess,
            tool_call_count: tools,
            tokens: tok,
        });
    }

    // Sum cost across all days
    let total_cost: f64 = day_map.values().map(|d| d.cost_accum.estimated_cost_usd()).sum();

    WeeklyData {
        days,
        total_messages,
        total_sessions,
        total_input_tokens: total_tokens,
        total_output_tokens: 0,
        total_cost_usd: total_cost,
    }
}

fn empty_rate_limits() -> RateLimits {
    RateLimits {
        plan_name: String::new(),
        is_real: false,
        session_pct: 0.0,
        session_resets_in_secs: 0,
        weekly_pct: 0.0,
        weekly_resets_in_secs: 0,
        weekly_resets_at: String::new(),
    }
}

/// Read the subscription plan name from credentials (without touching tokens).
fn read_plan_name(claude_dir: &PathBuf) -> String {
    let creds_path = claude_dir.join(".credentials.json");
    let content = match fs::read_to_string(&creds_path) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };
    let val: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    let tier = val
        .get("claudeAiOauth")
        .and_then(|o| o.get("rateLimitTier"))
        .and_then(|t| t.as_str())
        .unwrap_or("");
    let sub = val
        .get("claudeAiOauth")
        .and_then(|o| o.get("subscriptionType"))
        .and_then(|t| t.as_str())
        .unwrap_or("");

    // Map tier/subscription to a display name
    // Known tiers: default_claude_max_20x, default_claude_max_5x, default_claude_pro, etc.
    if tier.contains("max_20x") {
        "Max (20x)".to_string()
    } else if tier.contains("max_5x") {
        "Max (5x)".to_string()
    } else if tier.contains("team") || sub == "team" || sub == "team_premium" {
        "Team".to_string()
    } else if tier.contains("enterprise") || sub == "enterprise" {
        "Enterprise".to_string()
    } else if sub == "max" {
        // Generic max without specific multiplier in tier
        "Max".to_string()
    } else if sub == "pro" || tier.contains("pro") {
        "Pro".to_string()
    } else if sub == "free" || tier.contains("free") {
        "Free".to_string()
    } else if sub == "api" || tier.contains("api") {
        "API".to_string()
    } else if !sub.is_empty() {
        // Capitalize first letter of unknown subscription type
        let mut s = sub.to_string();
        if let Some(first) = s.get_mut(0..1) {
            first.make_ascii_uppercase();
        }
        s
    } else if !tier.is_empty() {
        tier.to_string()
    } else {
        "Unknown".to_string()
    }
}

/// Find the most recent Friday 1:00 PM local time that is in the past.
fn last_friday_1pm() -> chrono::NaiveDateTime {
    let now = chrono::Local::now().naive_local();
    let today = now.date();
    let weekday = today.weekday();

    // Days since Friday (Mon=0..Sun=6 in chrono, Fri=4)
    let days_since_friday = match weekday {
        chrono::Weekday::Fri => {
            if now.time() >= chrono::NaiveTime::from_hms_opt(13, 0, 0).unwrap() {
                0 // past 1pm Friday → this Friday
            } else {
                7 // before 1pm Friday → last Friday
            }
        }
        chrono::Weekday::Sat => 1,
        chrono::Weekday::Sun => 2,
        chrono::Weekday::Mon => 3,
        chrono::Weekday::Tue => 4,
        chrono::Weekday::Wed => 5,
        chrono::Weekday::Thu => 6,
    };

    let friday = today - chrono::Duration::days(days_since_friday);
    friday
        .and_time(chrono::NaiveTime::from_hms_opt(13, 0, 0).unwrap())
}

/// Fetch real usage data from Anthropic's OAuth usage API.
/// Caches the result for 60 seconds to avoid rate limiting.
fn compute_rate_limits(claude_dir: &PathBuf) -> RateLimits {
    let plan_name = read_plan_name(claude_dir);

    // Check cache first — only call API every 5 minutes
    {
        let cache = USAGE_CACHE.lock().unwrap();
        if let Some((instant, ref cached)) = *cache {
            if instant.elapsed() < std::time::Duration::from_secs(300) {
                // Return cached data with updated plan name
                let mut result = cached.clone();
                result.plan_name = plan_name;
                return result;
            }
        }
    }

    // Try the real API first, fall back to local estimation on any failure
    let body = fetch_usage_api(claude_dir);

    if body.is_none() {
        // API failed — return local estimate as fallback
        let fallback = compute_rate_limits_local(claude_dir);
        let result = RateLimits {
            plan_name,
            is_real: false,
            ..fallback
        };
        // Cache the fallback too so we don't hammer the API
        let mut cache = USAGE_CACHE.lock().unwrap();
        *cache = Some((std::time::Instant::now(), result.clone()));
        return result;
    }

    let body = body.unwrap();

    // Parse the response:
    // { "five_hour": { "utilization": 20.0, "resets_at": "2026-..." },
    //   "seven_day": { "utilization": 4.0, "resets_at": "2026-..." } }
    let now_utc = chrono::Utc::now();

    let session_pct = body
        .get("five_hour")
        .and_then(|v| v.get("utilization"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let session_resets_at = body
        .get("five_hour")
        .and_then(|v| v.get("resets_at"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let session_resets_in_secs = parse_reset_secs(session_resets_at, &now_utc);

    let weekly_pct = body
        .get("seven_day")
        .and_then(|v| v.get("utilization"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let weekly_resets_at_str = body
        .get("seven_day")
        .and_then(|v| v.get("resets_at"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let weekly_resets_in_secs = parse_reset_secs(weekly_resets_at_str, &now_utc);

    let result = RateLimits {
        plan_name,
        is_real: true,
        session_pct,
        session_resets_in_secs,
        weekly_pct,
        weekly_resets_in_secs,
        weekly_resets_at: weekly_resets_at_str.to_string(),
    };

    // Cache the result
    {
        let mut cache = USAGE_CACHE.lock().unwrap();
        *cache = Some((std::time::Instant::now(), result.clone()));
    }

    result
}

/// Try to fetch usage data from the Anthropic API. Returns None on any failure.
fn fetch_usage_api(claude_dir: &PathBuf) -> Option<serde_json::Value> {
    let token = read_oauth_token(claude_dir)?;
    let client = reqwest::blocking::Client::new();
    let resp = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Authorization", format!("Bearer {}", token))
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.json().ok()
}

/// Local fallback: estimate usage from JSONL token counts.
fn compute_rate_limits_local(claude_dir: &PathBuf) -> RateLimits {
    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return empty_rate_limits();
    }

    let now_utc = chrono::Utc::now();
    let now_local = chrono::Local::now();
    let five_hours_ago_utc = (now_utc - chrono::Duration::hours(5))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    // Calculate last Friday 1 PM in UTC for weekly window
    let weekly_reset_local = last_friday_1pm();
    let utc_offset_secs = now_local.offset().local_minus_utc() as i64;
    let weekly_reset_utc = weekly_reset_local - chrono::Duration::seconds(utc_offset_secs);
    let weekly_reset_iso = weekly_reset_utc.format("%Y-%m-%dT%H:%M:%S").to_string();

    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(8 * 24 * 3600);

    let mut session_accum = TokenAccum::default();
    let mut weekly_accum = TokenAccum::default();

    let project_entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return empty_rate_limits(),
    };

    for proj_entry in project_entries.flatten() {
        let proj_path = proj_entry.path();
        if !proj_path.is_dir() {
            continue;
        }
        let files = match fs::read_dir(&proj_path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for file_entry in files.flatten() {
            let path = file_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            let mtime = match path.metadata().and_then(|m| m.modified()) {
                Ok(t) => t,
                Err(_) => continue,
            };
            if mtime < cutoff {
                continue;
            }
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            for line in content.lines() {
                let val: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if val.get("type").and_then(|t| t.as_str()) != Some("assistant") {
                    continue;
                }
                let usage = match val.get("message").and_then(|m| m.get("usage")) {
                    Some(u) => u,
                    None => continue,
                };
                let timestamp = match val.get("timestamp").and_then(|t| t.as_str()) {
                    Some(t) => t,
                    None => continue,
                };
                let inp = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let out = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cr = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cw = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

                // Weekly window (since last Friday 1 PM)
                if timestamp >= weekly_reset_iso.as_str() {
                    weekly_accum.input += inp;
                    weekly_accum.output += out;
                    weekly_accum.cache_read += cr;
                    weekly_accum.cache_write += cw;
                }

                // 5-hour window
                if timestamp >= five_hours_ago_utc.as_str() {
                    session_accum.input += inp;
                    session_accum.output += out;
                    session_accum.cache_read += cr;
                    session_accum.cache_write += cw;
                }
            }
        }
    }

    // Estimate percentages using $1200 session / $6000 weekly budget (Max 20x calibrated)
    let session_cost = session_accum.estimated_cost_usd();
    let weekly_cost = weekly_accum.estimated_cost_usd();
    let session_pct = (session_cost / 1200.0 * 100.0).min(100.0);
    let weekly_pct = (weekly_cost / 6000.0 * 100.0).min(100.0);

    RateLimits {
        plan_name: String::new(),
        is_real: false,
        session_pct,
        session_resets_in_secs: 5 * 3600, // approximate
        weekly_pct,
        weekly_resets_in_secs: 0,
        weekly_resets_at: String::new(),
    }
}

/// Read the OAuth access token, auto-refreshing if expired.
fn read_oauth_token(claude_dir: &PathBuf) -> Option<String> {
    let creds_path = claude_dir.join(".credentials.json");
    let content = fs::read_to_string(&creds_path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;
    let oauth = val.get("claudeAiOauth")?;

    let token = oauth.get("accessToken")?.as_str()?.to_string();
    let expires_at = oauth.get("expiresAt").and_then(|v| v.as_u64()).unwrap_or(0);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // If token is still valid (with 60s buffer), use it
    if expires_at > now_ms + 60_000 {
        return Some(token);
    }

    // Token expired — try to refresh
    let refresh_token = oauth.get("refreshToken")?.as_str()?.to_string();
    refresh_oauth_token(claude_dir, &refresh_token, &val)
}

/// Refresh the OAuth token using the refresh token.
fn refresh_oauth_token(
    claude_dir: &PathBuf,
    refresh_token: &str,
    creds: &serde_json::Value,
) -> Option<String> {
    let client = reqwest::blocking::Client::new();

    // Use the same client_id that Claude Code uses for its OAuth flow
    let resp = client
        .post("https://console.anthropic.com/v1/oauth/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", "9d1c250a-e61b-44d9-88ed-5944d1962f5e"),
        ])
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let body: serde_json::Value = resp.json().ok()?;
    let new_token = body.get("access_token")?.as_str()?.to_string();
    let expires_in = body.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);

    // Save the refreshed token back to credentials file
    let mut updated = creds.clone();
    if let Some(oauth) = updated.get_mut("claudeAiOauth") {
        oauth["accessToken"] = serde_json::Value::String(new_token.clone());
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        oauth["expiresAt"] = serde_json::Value::Number((now_ms + expires_in * 1000).into());
    }

    let creds_path = claude_dir.join(".credentials.json");
    if let Ok(json) = serde_json::to_string_pretty(&updated) {
        let _ = fs::write(&creds_path, json);
    }

    Some(new_token)
}

/// Parse an ISO 8601 reset timestamp into seconds from now.
fn parse_reset_secs(reset_at: &str, now: &chrono::DateTime<chrono::Utc>) -> i64 {
    if reset_at.is_empty() {
        return 0;
    }
    // Try parsing with timezone offset
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(reset_at) {
        return (dt.with_timezone(&chrono::Utc) - now).num_seconds().max(0);
    }
    // Try parsing without timezone (assume UTC)
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&reset_at[..19], "%Y-%m-%dT%H:%M:%S")
    {
        let dt = naive.and_utc();
        return (dt - now).num_seconds().max(0);
    }
    0
}

/// Decode a project directory name back to a human-readable path.
/// e.g. "D--Apps-Claude-Code-Usage-App" → "D:\Apps\Claude Code Usage App"
fn decode_project_dir_name(name: &str) -> String {
    // Replace first "--" with ":\" (drive letter separator on Windows)
    // Then replace remaining "-" with " " or "\"
    // The encoding is: path separators become "-", ":" becomes "--"
    let mut result = name.to_string();

    // Handle drive letter: "D--" → "D:\"
    if result.len() >= 3 && result.chars().nth(1) == Some('-') && result.chars().nth(2) == Some('-') {
        let drive = result.chars().next().unwrap();
        result = format!("{}:\\{}", drive, &result[3..]);
    }

    // Replace remaining "-" with path separators
    result = result.replace('-', " ");

    // But consecutive spaces from "--" should become "\" (path separator)
    // Actually the encoding uses single "-" for path separators
    // Let's just replace "-" with "\" for the path part
    result
}

fn project_display_name(dir_name: &str) -> String {
    // Extract the last segment as the project name
    let decoded = decode_project_dir_name(dir_name);
    decoded
        .split(['/', '\\'])
        .last()
        .unwrap_or(dir_name)
        .to_string()
}

/// Scan all project directories and compute per-project usage stats.
fn collect_project_stats(claude_dir: &PathBuf) -> Vec<ProjectStats> {
    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return vec![];
    }

    let entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut projects: Vec<ProjectStats> = Vec::new();

    for entry in entries.flatten() {
        let proj_path = entry.path();
        if !proj_path.is_dir() {
            continue;
        }

        let dir_name = match entry.file_name().to_str() {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Skip non-project directories (plugin data, internal Claude dirs)
        let dir_lower = dir_name.to_lowercase();
        if dir_lower.contains("claude-mem")
            || dir_lower.contains("observer-session")
            || dir_lower.contains(".claude")
            || dir_name.starts_with('.')
            // Skip paths inside user home .claude directory
            || dir_name.starts_with("C--Users") && dir_name.contains("--claude")
        {
            continue;
        }

        let mut accum = TokenAccum::default();
        let mut message_count: u64 = 0;
        let mut session_ids: HashSet<String> = HashSet::new();
        let mut last_active: Option<String> = None;

        let files = match fs::read_dir(&proj_path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for file_entry in files.flatten() {
            let path = file_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            // Extract session ID from filename
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                session_ids.insert(stem.to_string());
            }

            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for line in content.lines() {
                let val: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                // Track last active timestamp
                if let Some(ts) = val.get("timestamp").and_then(|t| t.as_str()) {
                    if last_active.is_none() || ts > last_active.as_deref().unwrap_or("") {
                        last_active = Some(ts.to_string());
                    }
                }

                if val.get("type").and_then(|t| t.as_str()) != Some("assistant") {
                    continue;
                }
                let usage = match val.get("message").and_then(|m| m.get("usage")) {
                    Some(u) => u,
                    None => continue,
                };

                let inp = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let out = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cr = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cw = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);

                accum.input += inp;
                accum.output += out;
                accum.cache_read += cr;
                accum.cache_write += cw;
                message_count += 1;
            }
        }

        if message_count == 0 && session_ids.is_empty() {
            continue; // Skip empty projects
        }

        let name = project_display_name(&dir_name);
        let path_decoded = decode_project_dir_name(&dir_name);

        projects.push(ProjectStats {
            name,
            path: path_decoded,
            total_messages: message_count,
            total_tokens: accum.total(),
            total_cost_usd: accum.estimated_cost_usd(),
            input_tokens: accum.input,
            output_tokens: accum.output,
            cache_read_tokens: accum.cache_read,
            cache_write_tokens: accum.cache_write,
            session_count: session_ids.len() as u64,
            last_active_at: last_active.unwrap_or_default(),
        });
    }

    // Sort by last active (most recent first)
    projects.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    projects
}

fn empty_timeline() -> TimelineData {
    TimelineData {
        daily_activity: vec![],
        daily_by_model: vec![],
        active_days: 0,
        current_streak: 0,
        longest_streak: 0,
        peak_hour: 0,
        favorite_model: String::new(),
    }
}

/// Scan ALL project JSONL files to build a year-long timeline of activity.
/// Calculates per-day token counts, per-model daily tokens, streaks, peak hour,
/// favorite model, and active days.
fn collect_timeline_data(claude_dir: &PathBuf) -> TimelineData {
    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return empty_timeline();
    }

    let today = chrono::Local::now().date_naive();
    let year_ago = today - chrono::Duration::days(365);
    let year_ago_str = year_ago.format("%Y-%m-%d").to_string();

    // date -> total message count
    let mut daily_counts: HashMap<String, u64> = HashMap::new();
    // date -> model -> tokens
    let mut daily_model_tokens: HashMap<String, HashMap<String, u64>> = HashMap::new();
    // hour (0-23) -> count
    let mut hour_counts: HashMap<u32, u64> = HashMap::new();
    // model -> total tokens (for favorite)
    let mut model_totals: HashMap<String, u64> = HashMap::new();

    let project_entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(_) => return empty_timeline(),
    };

    for proj_entry in project_entries.flatten() {
        let proj_path = proj_entry.path();
        if !proj_path.is_dir() {
            continue;
        }

        // Skip non-project dirs
        if let Some(name) = proj_entry.file_name().to_str() {
            let lower = name.to_lowercase();
            if lower.contains("claude-mem")
                || lower.contains("observer-session")
                || name.starts_with('.')
            {
                continue;
            }
        }

        let files = match fs::read_dir(&proj_path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for file_entry in files.flatten() {
            let path = file_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for line in content.lines() {
                let val: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                if val.get("type").and_then(|t| t.as_str()) != Some("assistant") {
                    continue;
                }

                let timestamp = match val.get("timestamp").and_then(|t| t.as_str()) {
                    Some(t) => t,
                    None => continue,
                };

                // Only last year
                let date = &timestamp[..10];
                if date < year_ago_str.as_str() {
                    continue;
                }

                let usage = val.get("message").and_then(|m| m.get("usage"));
                let model = val
                    .get("message")
                    .and_then(|m| m.get("model"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Count messages per day
                *daily_counts.entry(date.to_string()).or_insert(0) += 1;

                // Extract hour from timestamp (format: YYYY-MM-DDTHH:MM:SS)
                if timestamp.len() >= 13 {
                    if let Ok(h) = timestamp[11..13].parse::<u32>() {
                        *hour_counts.entry(h).or_insert(0) += 1;
                    }
                }

                // Accumulate tokens per model per day
                if let Some(u) = usage {
                    let inp = u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                    let out = u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                    let total = inp + out; // exclude cache tokens for "real" usage

                    let day_map = daily_model_tokens
                        .entry(date.to_string())
                        .or_default();
                    *day_map.entry(model.clone()).or_insert(0) += total;
                    *model_totals.entry(model).or_insert(0) += total;
                }
            }
        }
    }

    // Build 365-day heatmap (fill in zeros for days with no activity)
    let mut daily_activity: Vec<HeatmapDay> = Vec::with_capacity(365);
    for i in 0..365 {
        let d = year_ago + chrono::Duration::days(i + 1);
        let ds = d.format("%Y-%m-%d").to_string();
        let count = daily_counts.get(&ds).copied().unwrap_or(0);
        daily_activity.push(HeatmapDay { date: ds, count });
    }

    // Build daily_by_model sorted by date
    let mut daily_by_model: Vec<DailyModelTokens> = daily_model_tokens
        .into_iter()
        .map(|(date, tokens_by_model)| DailyModelTokens { date, tokens_by_model })
        .collect();
    daily_by_model.sort_by(|a, b| a.date.cmp(&b.date));

    // Active days = days with any activity
    let active_days = daily_counts.len() as u64;

    // Calculate streaks
    let (current_streak, longest_streak) =
        calculate_streaks(&daily_counts, today);

    // Peak hour (hour with highest count)
    let peak_hour = hour_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(h, _)| *h)
        .unwrap_or(0);

    // Favorite model (most tokens)
    let favorite_model = model_totals
        .iter()
        .max_by_key(|(_, tokens)| *tokens)
        .map(|(m, _)| m.clone())
        .unwrap_or_default();

    TimelineData {
        daily_activity,
        daily_by_model,
        active_days,
        current_streak,
        longest_streak,
        peak_hour,
        favorite_model,
    }
}

/// Returns (current_streak, longest_streak). A streak is consecutive days with activity.
/// Current streak must include today (or yesterday if today has no activity yet).
fn calculate_streaks(
    daily_counts: &HashMap<String, u64>,
    today: chrono::NaiveDate,
) -> (u64, u64) {
    let mut longest: u64 = 0;
    let mut current: u64 = 0;

    // Gather all dates with activity, sorted
    let mut dates: Vec<chrono::NaiveDate> = daily_counts
        .keys()
        .filter_map(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .collect();
    dates.sort();

    if dates.is_empty() {
        return (0, 0);
    }

    // Calculate longest streak
    let mut run: u64 = 1;
    for i in 1..dates.len() {
        let prev = dates[i - 1];
        let curr = dates[i];
        if curr == prev + chrono::Duration::days(1) {
            run += 1;
            if run > longest {
                longest = run;
            }
        } else {
            run = 1;
        }
    }
    if run > longest {
        longest = run;
    }

    // Calculate current streak: count back from today (or yesterday if today has no activity)
    let mut check_date = today;
    if !daily_counts.contains_key(&check_date.format("%Y-%m-%d").to_string()) {
        check_date = today - chrono::Duration::days(1);
    }
    loop {
        let ds = check_date.format("%Y-%m-%d").to_string();
        if daily_counts.contains_key(&ds) {
            current += 1;
            check_date -= chrono::Duration::days(1);
        } else {
            break;
        }
    }

    (current, longest)
}
