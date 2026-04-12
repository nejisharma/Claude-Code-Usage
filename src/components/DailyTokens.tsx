import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { WeeklyData } from "../types";

interface Props {
  weekly: WeeklyData;
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

export default function DailyTokens({ weekly }: Props) {
  const data = weekly.days.map((d) => ({
    day: getDayLabel(d.date),
    messages: d.messageCount,
    tools: d.toolCallCount,
    tokens: d.tokens,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="day" tick={{ fill: "#8888a0", fontSize: 11 }} axisLine={{ stroke: "#2a2a3a" }} tickLine={false} />
        <YAxis tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Bar dataKey="messages" fill="#c084fc" name="Messages" radius={[4, 4, 0, 0]} />
        <Bar dataKey="tools" fill="#60a5fa" name="Tool Calls" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
