import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { ModelTokens } from "../types";

interface Props {
  models: Record<string, ModelTokens>;
}

// API pricing per million tokens
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  opus:   { input: 15,  output: 75,  cacheRead: 1.5,   cacheWrite: 18.75 },
  sonnet: { input: 3,   output: 15,  cacheRead: 0.3,   cacheWrite: 3.75  },
  haiku:  { input: 0.8, output: 4,   cacheRead: 0.08,  cacheWrite: 1     },
};

function getModelKey(name: string): string {
  if (name.includes("opus")) return "opus";
  if (name.includes("sonnet")) return "sonnet";
  if (name.includes("haiku")) return "haiku";
  return "opus"; // fallback
}

function prettyName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function getColor(model: string): string {
  if (model.includes("opus")) return "#c084fc";
  if (model.includes("sonnet")) return "#60a5fa";
  if (model.includes("haiku")) return "#34d399";
  return "#94a3b8";
}

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function ModelCostComparison({ models }: Props) {
  const entries = Object.entries(models);
  if (entries.length === 0) return <p className="empty-text">No model data</p>;

  const data = entries.map(([model, tokens]) => {
    const key = getModelKey(model);
    const pricing = MODEL_PRICING[key] ?? MODEL_PRICING.opus;

    const inputCost = (tokens.inputTokens * pricing.input) / 1_000_000;
    const outputCost = (tokens.outputTokens * pricing.output) / 1_000_000;
    const cacheReadCost = (tokens.cacheReadInputTokens * pricing.cacheRead) / 1_000_000;
    const cacheWriteCost = (tokens.cacheCreationInputTokens * pricing.cacheWrite) / 1_000_000;
    const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

    return {
      name: prettyName(model),
      model,
      input: Math.round(inputCost * 100) / 100,
      output: Math.round(outputCost * 100) / 100,
      cacheRead: Math.round(cacheReadCost * 100) / 100,
      cacheWrite: Math.round(cacheWriteCost * 100) / 100,
      total: totalCost,
      totalTokens: tokens.inputTokens + tokens.outputTokens + tokens.cacheReadInputTokens + tokens.cacheCreationInputTokens,
      color: getColor(model),
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="model-cost-inner">
      <div className="model-cost-chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="name" tick={{ fill: "#e8e8f0", fontSize: 12 }} axisLine={{ stroke: "#2a2a3a" }} tickLine={false} />
            <YAxis tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="input" stackId="cost" name="Input" fill="#60a5fa" />
            <Bar dataKey="output" stackId="cost" name="Output" fill="#34d399" />
            <Bar dataKey="cacheRead" stackId="cost" name="Cache Read" fill="#fb923c" />
            <Bar dataKey="cacheWrite" stackId="cost" name="Cache Write" fill="#c084fc" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="model-cost-table">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th className="num">Tokens</th>
              <th className="num">Input</th>
              <th className="num">Output</th>
              <th className="num">Cache</th>
              <th className="num">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.model}>
                <td>
                  <span className="model-cost-dot" style={{ backgroundColor: d.color }} />
                  {d.name}
                </td>
                <td className="num">{formatTokens(d.totalTokens)}</td>
                <td className="num">{formatCost(d.input)}</td>
                <td className="num">{formatCost(d.output)}</td>
                <td className="num">{formatCost(d.cacheRead + d.cacheWrite)}</td>
                <td className="num cost-cell">{formatCost(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
