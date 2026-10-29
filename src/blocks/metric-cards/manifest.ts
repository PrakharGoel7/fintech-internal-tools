import { z } from "zod";
import type { BlockManifest } from "../types";
import { conditionsSchema, formatSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string(),
  metrics: z.array(z.object({
    label: z.string(),
    agg: z.enum(["count", "sum", "avg", "max", "min", "ratio"]),
    field: z.string().optional().describe("Required for sum/avg/max/min"),
    where: conditionsSchema.optional(),
    numerator: conditionsSchema.optional().describe("Required for ratio: % of rows (after `where`) that also match these conditions"),
    format: formatSchema.default("number"),
    tone: z.enum(["neutral", "good", "warn", "bad"]).default("neutral"),
  }).refine((m) => m.agg !== "ratio" || !!m.numerator?.length, { message: "ratio requires numerator conditions", path: ["numerator"] })).min(1).max(6),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "metric-cards",
  version: "1.1.0",
  category: "insight",
  summary: "Row of KPI cards computed from a data source (count/sum/avg/max/min, or ratio = % of rows matching conditions).",
  useWhen: ["Headline numbers at the top of a dashboard or queue"],
  notFor: ["Trends over time (use chart)"],
  requires: ["rbac"],
  emitsAudit: [],
  permissions: ["view"],
  configSchema,
  example: { source: "refunds", metrics: [{ label: "Open requests", agg: "count", where: [{ field: "status", op: "eq", value: "requested" }] }, { label: "Refunded (30d)", agg: "sum", field: "amount", format: "currency", where: [{ field: "created_at", op: "gte", value: "$now-30d" }] }, { label: "Denial rate", agg: "ratio", numerator: [{ field: "status", op: "eq", value: "denied" }], where: [{ field: "status", op: "in", value: ["issued", "denied"] }], format: "percent" }] },
};
