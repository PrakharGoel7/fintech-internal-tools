import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { formatPlain } from "../_shared/format";
import { aggregate } from "../_shared/aggregate";

const TONE = { neutral: "text-slate-900", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600" };

export function MetricCards({ config }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {config.metrics.map((m) => {
        const v = aggregate(source.list({ where: m.where }), m.agg, m.field);
        return (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${TONE[m.tone]}`}>{formatPlain(v, m.format)}</div>
          </div>
        );
      })}
    </div>
  );
}
