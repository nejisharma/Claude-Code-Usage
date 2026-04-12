import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ProjectStats } from "../types";

interface Props {
  projects: ProjectStats[];
}

export default function CostBreakdown({ projects }: Props) {
  const top10 = [...projects]
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 12) + ".." : p.name,
      cost: Math.round(p.totalCostUsd * 100) / 100,
    }));

  if (top10.length === 0) return <p className="empty-text">No project data</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={top10} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="name" tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={{ stroke: "#2a2a3a" }} tickLine={false} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Est. Cost"]} />
        <Bar dataKey="cost" fill="#c084fc" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
