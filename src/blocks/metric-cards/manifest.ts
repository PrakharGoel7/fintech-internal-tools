import { z } from "zod";
import type { BlockManifest } from "../types";
import { conditionsSchema, formatSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string(),
  metrics: z.array(z.object({
    label: z.string(),
    agg: z.enum(["count", "sum", "avg", "max", "min"]),
    field: z.string().optional().describe("Required for sum/avg/max/min"),
    where: conditionsSchema.optional(),
    format: formatSchema.default("number"),
    tone: z.enum(["neutral", "good", "warn", "bad"]).default("neutral"),
  })).min(1).max(6),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "metric-cards",
  version: "1.0.1",
  category: "insight",
  summary: "Row of KPI cards computed from a data source (count/sum/avg with filters).",
  useWhen: ["Headline numbers at the top of a dashboard or queue"],
  notFor: ["Trends over time (use chart)"],
  requires: ["rbac"],
  emitsAudit: [],
  permissions: ["view"],
  configSchema,
  example: { source: "refunds", metrics: [{ label: "Open requests", agg: "count", where: [{ field: "status", op: "eq", value: "requested" }] }, { label: "Refunded (30d)", agg: "sum", field: "amount", format: "currency" }] },
};
