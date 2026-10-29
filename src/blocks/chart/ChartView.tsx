"use client";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export function ChartView({ kind, data, currency }: { kind: "bar" | "line" | "pie"; data: { name: string; value: number }[]; currency: boolean }) {
  const fmt = (v: number) => (currency ? `$${v.toLocaleString()}` : v.toLocaleString());
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label={(e) => String(e.name ?? "").replace(/_/g, " ")}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v))} />
          </PieChart>
        ) : kind === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis fontSize={11} tickFormatter={fmt} width={60} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} tickFormatter={(v: string) => v.replace(/_/g, " ")} />
            <YAxis fontSize={11} tickFormatter={fmt} width={60} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
