import type { RateLimits } from "../types";

interface Props {
  limits: RateLimits;
}

function formatResetTime(secs: number): string {
  if (secs <= 0) return "now";
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getPlanColor(plan: string): string {
  if (plan.includes("20x")) return "#c084fc";
  if (plan.includes("5x") || plan === "Max") return "#60a5fa";
  if (plan === "Pro") return "#34d399";
  if (plan === "Team" || plan === "Enterprise") return "#fb923c";
  return "#94a3b8";
}

function getPlanDescription(plan: string): string {
  if (plan.includes("20x")) return "20x Pro usage limits";
  if (plan.includes("5x")) return "5x Pro usage limits";
  if (plan === "Max") return "Elevated usage limits";
  if (plan === "Pro") return "Standard usage limits";
  if (plan === "Team") return "Team plan limits";
  if (plan === "Enterprise") return "Enterprise limits";
  if (plan === "Free") return "Limited usage";
  if (plan === "API") return "Pay-per-token";
  return "";
}

function getBarColor(pct: number): string {
  if (pct < 50) return "var(--accent-green)";
  if (pct < 80) return "var(--accent-orange)";
  return "var(--accent-red)";
}

export default function RateLimitsCard({ limits }: Props) {
  if (!limits.planName) return null;

  const planColor = getPlanColor(limits.planName);
  const planDesc = getPlanDescription(limits.planName);

  const sessionPct = limits.sessionPct;
  const weeklyPct = limits.weeklyPct;

  return (
    <div className="rate-limits-inner">
      <div className="plan-header-row">
        <span className="plan-badge" style={{ color: planColor, borderColor: planColor + "40", background: planColor + "18" }}>
          {limits.planName}
        </span>
        {planDesc && <span className="plan-desc">{planDesc}</span>}
      </div>

      {/* Session Limit */}
      <div className="rate-limit-row">
        <div className="rate-limit-header">
          <span className="rate-limit-name">Current Session</span>
          <span className="rate-limit-pct" style={{ color: getBarColor(sessionPct) }}>
            {Math.round(sessionPct)}% used
          </span>
        </div>
        <div className="rate-limit-bar-bg">
          <div
            className="rate-limit-bar-fill"
            style={{
              width: `${Math.max(sessionPct, sessionPct > 0 ? 1 : 0)}%`,
              backgroundColor: getBarColor(sessionPct),
            }}
          />
        </div>
        <div className="rate-limit-sub">
          <span>
            {limits.isReal ? "" : "~"}5h rolling window
          </span>
          <span>
            {sessionPct > 0
              ? `Resets in ${formatResetTime(limits.sessionResetsInSecs)}`
              : "No usage"}
          </span>
        </div>
      </div>

      {/* Weekly Limit */}
      <div className="rate-limit-row">
        <div className="rate-limit-header">
          <span className="rate-limit-name">Weekly — All Models</span>
          <span className="rate-limit-pct" style={{ color: getBarColor(weeklyPct) }}>
            {Math.round(weeklyPct)}% used
          </span>
        </div>
        <div className="rate-limit-bar-bg">
          <div
            className="rate-limit-bar-fill"
            style={{
              width: `${Math.max(weeklyPct, weeklyPct > 0 ? 1 : 0)}%`,
              backgroundColor: getBarColor(weeklyPct),
            }}
          />
        </div>
        <div className="rate-limit-sub">
          <span>7-day window</span>
          <span>Resets in {formatResetTime(limits.weeklyResetsInSecs)}</span>
        </div>
      </div>

      {!limits.isReal && (
        <p className="rate-limit-note">
          Could not reach Anthropic API — showing estimates.
        </p>
      )}
    </div>
  );
}
