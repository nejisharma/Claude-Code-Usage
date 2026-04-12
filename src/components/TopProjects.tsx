import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { ProjectStats } from "../types";

interface Props {
  projects: ProjectStats[];
}

const COLORS = ["#c084fc", "#60a5fa", "#34d399", "#fb923c", "#f87171"];

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function TopProjects({ projects }: Props) {
  const top5 = [...projects]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 5)
    .map((p) => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + ".." : p.name,
      tokens: p.totalTokens,
      messages: p.totalMessages,
    }));

  if (top5.length === 0) return <p className="empty-text">No project data</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={top5} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTokens(v)} />
        <YAxis type="category" dataKey="name" tick={{ fill: "#e8e8f0", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
        <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => [formatTokens(v), "Tokens"]} />
        <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
          {top5.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
