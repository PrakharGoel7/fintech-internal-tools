"use client";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

/** Series palette; first colour is brand-600 from globals.css. */
const COLORS = ["#2552eb", "#38bdf8", "#14b8a6", "#f59e0b", "#f43f5e", "#a78bfa", "#94a3b8"];
const AXIS = { fontSize: 11, tick: { fill: "#64748b" }, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px -8px rgb(15 23 42 / 0.2)", fontSize: 12, padding: "6px 10px" },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
  cursor: { fill: "#f1f5f9" },
};

export function ChartView({ kind, data, currency }: { kind: "bar" | "line" | "pie"; data: { name: string; value: number }[]; currency: boolean }) {
  const fmt = (v: number) => (currency ? `$${v.toLocaleString()}` : v.toLocaleString());
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v))} {...TOOLTIP} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} formatter={(v) => <span className="text-slate-600">{String(v).replace(/_/g, " ")}</span>} />
          </PieChart>
        ) : kind === "line" ? (
          <LineChart data={data}>
            <CartesianGrid stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="name" {...AXIS} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis {...AXIS} tickFormatter={fmt} width={60} />
            <Tooltip formatter={(v) => fmt(Number(v))} {...TOOLTIP} cursor={{ stroke: "#cbd5e1" }} />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="name" {...AXIS} tickFormatter={(v: string) => v.replace(/_/g, " ")} />
            <YAxis {...AXIS} tickFormatter={fmt} width={60} />
            <Tooltip formatter={(v) => fmt(Number(v))} {...TOOLTIP} />
            <Bar dataKey="value" fill={COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
