import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { formatPlain } from "../_shared/format";

export function aggregate(rows: Record<string, unknown>[], agg: string, field?: string) {
  if (agg === "count") return rows.length;
  const vals = rows.map((r) => Number(r[field!])).filter((n) => !Number.isNaN(n));
  if (!vals.length) return 0;
  if (agg === "sum") return vals.reduce((a, b) => a + b, 0);
  if (agg === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === "max") return Math.max(...vals);
  return Math.min(...vals);
}

const TONE = { neutral: "text-slate-900", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600" };
const DOT = { neutral: "bg-slate-300", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500" };

export function MetricCards({ config }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {config.metrics.map((m) => {
        const v = aggregate(source.list({ where: m.where }), m.agg, m.field);
        return (
          <div key={m.label} className="card p-4">
            <div className="eyebrow flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${DOT[m.tone]}`} />{m.label}</div>
            <div className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${TONE[m.tone]}`}>{formatPlain(v, m.format)}</div>
          </div>
        );
      })}
    </div>
  );
}
