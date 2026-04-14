import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { TimelineData } from "../types";

interface Props {
  timeline: TimelineData;
}

type Range = "7d" | "30d" | "all";

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

function prettyName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (model.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function getColor(model: string): string {
  if (model.includes("opus")) return "#c084fc";
  if (model.includes("sonnet-4-6")) return "#7c3aed";
  if (model.includes("sonnet")) return "#60a5fa";
  if (model.includes("haiku")) return "#34d399";
  return "#94a3b8";
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ModelsTimeline({ timeline }: Props) {
  const [range, setRange] = useState<Range>("30d");

  const { chartData, modelTotals, allModels } = useMemo(() => {
    let data = [...timeline.dailyByModel];

    if (range === "7d") data = data.slice(-7);
    else if (range === "30d") data = data.slice(-30);

    // Collect all unique models
    const modelSet = new Set<string>();
    data.forEach((d) => Object.keys(d.tokensByModel).forEach((m) => modelSet.add(m)));
    const allModels = Array.from(modelSet).sort();

    // Build chart rows: { date, "opus": 123, "sonnet": 456, ... }
    const chartData = data.map((d) => {
      const row: Record<string, number | string> = { date: formatDateLabel(d.date) };
      for (const m of allModels) {
        row[m] = d.tokensByModel[m] || 0;
      }
      return row;
    });

    // Totals per model for legend
    const totals: Record<string, number> = {};
    for (const d of data) {
      for (const [m, tokens] of Object.entries(d.tokensByModel)) {
        totals[m] = (totals[m] || 0) + tokens;
      }
    }

    return { chartData, modelTotals: totals, allModels };
  }, [timeline, range]);

  const grandTotal = Object.values(modelTotals).reduce((s, t) => s + t, 0);

  if (chartData.length === 0) {
    return <p className="empty-text">No timeline data yet</p>;
  }

  return (
    <div className="models-timeline-inner">
      <div className="models-timeline-header">
        <div className="timeline-range-buttons">
          <button
            className={`timeline-range-btn ${range === "7d" ? "active" : ""}`}
            onClick={() => setRange("7d")}
          >
            7d
          </button>
          <button
            className={`timeline-range-btn ${range === "30d" ? "active" : ""}`}
            onClick={() => setRange("30d")}
          >
            30d
          </button>
          <button
            className={`timeline-range-btn ${range === "all" ? "active" : ""}`}
            onClick={() => setRange("all")}
          >
            All
          </button>
        </div>
      </div>

      <div className="models-timeline-chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8888a0", fontSize: 10 }}
              axisLine={{ stroke: "#2a2a3a" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#8888a0", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTokens}
            />
            <Tooltip
              contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }}
              formatter={(v: number, name: string) => [formatTokens(v), prettyName(name)]}
            />
            <Legend formatter={prettyName} wrapperStyle={{ fontSize: "11px" }} />
            {allModels.map((model, i) => (
              <Bar
                key={model}
                dataKey={model}
                stackId="models"
                fill={getColor(model)}
                radius={i === allModels.length - 1 ? [3, 3, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="models-timeline-legend">
        {Object.entries(modelTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([model, tokens]) => (
            <div key={model} className="timeline-legend-item">
              <span className="timeline-legend-dot" style={{ backgroundColor: getColor(model) }} />
              <span className="timeline-legend-name">{prettyName(model)}</span>
              <span className="timeline-legend-tokens">{formatTokens(tokens)}</span>
              <span className="timeline-legend-pct">
                {grandTotal > 0 ? ((tokens / grandTotal) * 100).toFixed(1) : "0"}%
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
