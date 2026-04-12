import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyData } from "../types";

interface Props {
  weekly: WeeklyData;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function WeeklyUsage({ weekly }: Props) {
  const chartData = weekly.days.map((d) => ({
    day: getDayLabel(d.date),
    date: d.date,
    messages: d.messageCount,
    tokens: d.tokens,
    sessions: d.sessionCount,
    tools: d.toolCallCount,
  }));

  return (
    <div className="weekly-inner">

      <div className="weekly-stats">
        <div className="weekly-stat">
          <span className="weekly-stat-value">{weekly.totalMessages.toLocaleString()}</span>
          <span className="weekly-stat-label">Messages</span>
        </div>
        <div className="weekly-stat">
          <span className="weekly-stat-value">{weekly.totalSessions.toLocaleString()}</span>
          <span className="weekly-stat-label">Sessions</span>
        </div>
        <div className="weekly-stat">
          <span className="weekly-stat-value">{formatTokens(weekly.totalInputTokens)}</span>
          <span className="weekly-stat-label">Tokens</span>
        </div>
      </div>

      <div className="weekly-chart">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c084fc" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tokGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#8888a0", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a3a" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8888a0", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#e8e8f0" }}
              labelStyle={{ color: "#8888a0" }}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="#c084fc"
              fill="url(#msgGrad)"
              strokeWidth={2}
              name="Messages"
            />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="#60a5fa"
              fill="url(#tokGrad)"
              strokeWidth={2}
              name="Sessions"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
