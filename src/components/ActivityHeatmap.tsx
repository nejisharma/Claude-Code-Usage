import type { TimelineData } from "../types";

interface Props {
  timeline: TimelineData;
  totalMessages: number;
  totalSessions: number;
  totalTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function prettyModel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model || "—";
}

function getCellColor(count: number, max: number): string {
  if (count === 0) return "rgba(42, 42, 58, 0.4)";
  const intensity = Math.min(count / (max * 0.7), 1);
  if (intensity < 0.2) return "rgba(96, 165, 250, 0.25)";
  if (intensity < 0.4) return "rgba(96, 165, 250, 0.45)";
  if (intensity < 0.6) return "rgba(96, 165, 250, 0.65)";
  if (intensity < 0.8) return "rgba(96, 165, 250, 0.85)";
  return "rgba(96, 165, 250, 1)";
}

function getFunFact(tokens: number): string {
  const comparisons = [
    { name: "Harry Potter and the Philosopher's Stone", tokens: 100_000 },
    { name: "The Lord of the Rings trilogy", tokens: 650_000 },
    { name: "War and Peace", tokens: 800_000 },
    { name: "the entire Bible", tokens: 1_100_000 },
    { name: "the complete works of Shakespeare", tokens: 1_200_000 },
    { name: "the Harry Potter series", tokens: 1_400_000 },
  ];

  // Find the biggest comparison that's still smaller than our token count
  let bestComparison = comparisons[0];
  for (const c of comparisons) {
    if (c.tokens <= tokens) bestComparison = c;
  }

  const multiplier = tokens / bestComparison.tokens;
  if (multiplier >= 1) {
    return `You've used ~${multiplier.toFixed(0)}× more tokens than ${bestComparison.name}.`;
  }
  const pct = (tokens / bestComparison.tokens) * 100;
  return `You've used ~${pct.toFixed(0)}% of the tokens in ${bestComparison.name}.`;
}

export default function ActivityHeatmap({ timeline, totalMessages, totalSessions, totalTokens }: Props) {
  const days = timeline.dailyActivity;

  // Group into weeks (53 weeks × 7 days)
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  // Show last ~26 weeks (6 months) for better visibility
  const weeksToShow = 26;
  const daysToShow = weeksToShow * 7;
  const visibleDays = days.slice(-daysToShow);

  // Pad to align with day-of-week
  const firstDate = new Date(visibleDays[0]?.date + "T00:00:00");
  const firstDayOfWeek = firstDate.getDay();
  const padded = [
    ...Array(firstDayOfWeek).fill(null),
    ...visibleDays,
  ];

  // Build weeks (columns)
  const weeks: (typeof visibleDays[0] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const stats = [
    { label: "Sessions", value: totalSessions.toLocaleString() },
    { label: "Messages", value: totalMessages.toLocaleString() },
    { label: "Total tokens", value: formatTokens(totalTokens) },
    { label: "Active days", value: timeline.activeDays.toString() },
    { label: "Current streak", value: `${timeline.currentStreak}d` },
    { label: "Longest streak", value: `${timeline.longestStreak}d` },
    { label: "Peak hour", value: formatHour(timeline.peakHour) },
    { label: "Favorite model", value: prettyModel(timeline.favoriteModel) },
  ];

  return (
    <div className="heatmap-inner">
      <div className="heatmap-stats">
        {stats.map((s) => (
          <div key={s.label} className="heatmap-stat">
            <span className="heatmap-stat-label">{s.label}</span>
            <span className="heatmap-stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-week">
            {week.map((day, di) => (
              <div
                key={di}
                className="heatmap-cell"
                style={{ backgroundColor: day ? getCellColor(day.count, maxCount) : "transparent" }}
                title={day ? `${day.date}: ${day.count} messages` : ""}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="heatmap-funfact">{getFunFact(totalTokens)}</p>
    </div>
  );
}
