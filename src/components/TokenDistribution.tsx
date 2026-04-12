import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ModelTokens } from "../types";

interface Props {
  models: Record<string, ModelTokens>;
}

const COLORS = ["#c084fc", "#60a5fa", "#34d399", "#fb923c", "#f87171"];

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function TokenDistribution({ models }: Props) {
  // Aggregate all token types across models
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;

  for (const m of Object.values(models)) {
    totalInput += m.inputTokens;
    totalOutput += m.outputTokens;
    totalCacheRead += m.cacheReadInputTokens;
    totalCacheWrite += m.cacheCreationInputTokens;
  }

  const data = [
    { name: "Input", value: totalInput, color: "#60a5fa" },
    { name: "Output", value: totalOutput, color: "#34d399" },
    { name: "Cache Read", value: totalCacheRead, color: "#fb923c" },
    { name: "Cache Write", value: totalCacheWrite, color: "#c084fc" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="token-dist-inner">
      <div className="token-dist-content">
        <div className="token-dist-chart">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatTokens(value)}
                contentStyle={{
                  background: "#1a1a24",
                  border: "1px solid #2a2a3a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "#e8e8f0" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="token-dist-legend">
          {data.map((d) => (
            <div key={d.name} className="token-dist-item">
              <span className="token-dist-dot" style={{ backgroundColor: d.color }} />
              <span className="token-dist-label">{d.name}</span>
              <span className="token-dist-value">{formatTokens(d.value)}</span>
              <span className="token-dist-pct">
                {((d.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
