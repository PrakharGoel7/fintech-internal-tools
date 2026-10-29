import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { aggregate } from "../metric-cards/MetricCards";
import { ChartView } from "./ChartView";

export function Chart({ config, title }: BlockProps<z.infer<typeof configSchema>>) {
  const rows = getSource(config.source).list({ where: config.where });
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    let k = String(r[config.groupBy] ?? "—");
    if (config.bucket === "day") k = k.slice(0, 10);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const data = [...groups.entries()]
    .map(([name, rs]) => ({ name, value: Math.round(aggregate(rs, config.agg, config.field) * 100) / 100 }))
    .sort((a, b) => (config.bucket === "day" ? a.name.localeCompare(b.name) : b.value - a.value));
  return (
    <div className="card p-4">
      <h3 className="card-title mb-2">{title ?? config.groupBy}</h3>
      <ChartView kind={config.kind} data={data} currency={config.currency} />
    </div>
  );
}
