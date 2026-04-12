import type { UsageData } from "../types";

interface Props {
  data: UsageData;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export default function QuickStats({ data }: Props) {
  const allTimeCost = data.projects.reduce((s, p) => s + p.totalCostUsd, 0);
  const weeklyCost = data.weekly.totalCostUsd;
  const totalTokens = data.projects.reduce((s, p) => s + p.totalTokens, 0);
  const avgMsgsPerSession = data.totalSessions > 0
    ? Math.round(data.totalMessages / data.totalSessions)
    : 0;

  const busiest = data.weekly.days.reduce(
    (best, d) => (d.messageCount > best.messageCount ? d : best),
    data.weekly.days[0] || { date: "—", messageCount: 0 }
  );
  const busiestDay = busiest?.date
    ? new Date(busiest.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })
    : "—";

  return (
    <div className="quick-stats-grid">
      <div className="qs-item">
        <span className="qs-value purple">{formatCost(weeklyCost)}</span>
        <span className="qs-label">This Week Cost</span>
      </div>
      <div className="qs-item">
        <span className="qs-value purple">{formatCost(allTimeCost)}</span>
        <span className="qs-label">All-Time Cost</span>
      </div>
      <div className="qs-item">
        <span className="qs-value blue">{formatTokens(totalTokens)}</span>
        <span className="qs-label">All-Time Tokens</span>
      </div>
      <div className="qs-item">
        <span className="qs-value green">{data.totalSessions}</span>
        <span className="qs-label">Total Sessions</span>
      </div>
      <div className="qs-item">
        <span className="qs-value orange">{avgMsgsPerSession}</span>
        <span className="qs-label">Avg Msgs/Session</span>
      </div>
      <div className="qs-item">
        <span className="qs-value">{data.projects.length}</span>
        <span className="qs-label">Projects</span>
      </div>
      <div className="qs-item">
        <span className="qs-value">{busiestDay}</span>
        <span className="qs-label">Busiest Day</span>
      </div>
    </div>
  );
}
