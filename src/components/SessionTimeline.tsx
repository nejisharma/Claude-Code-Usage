import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { WeeklyData } from "../types";

interface Props {
  weekly: WeeklyData;
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

export default function SessionTimeline({ weekly }: Props) {
  const data = weekly.days.map((d) => ({
    day: getDayLabel(d.date),
    sessions: d.sessionCount,
    tools: d.toolCallCount,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <defs>
          <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="toolGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="day" tick={{ fill: "#8888a0", fontSize: 11 }} axisLine={{ stroke: "#2a2a3a" }} tickLine={false} />
        <YAxis tick={{ fill: "#8888a0", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" }} />
        <Area type="monotone" dataKey="sessions" stroke="#34d399" fill="url(#sessGrad)" strokeWidth={2} name="Sessions" />
        <Area type="monotone" dataKey="tools" stroke="#fb923c" fill="url(#toolGrad)" strokeWidth={2} name="Tool Calls" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
