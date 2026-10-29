import { z } from "zod";
import type { BlockManifest } from "../types";
import { conditionsSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string(),
  kind: z.enum(["bar", "line", "pie"]).default("bar"),
  groupBy: z.string(),
  bucket: z.enum(["none", "day"]).default("none").describe("Bucket date fields by day"),
  agg: z.enum(["count", "sum", "avg"]).default("count"),
  field: z.string().optional(),
  where: conditionsSchema.optional(),
  currency: z.boolean().default(false),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "chart",
  version: "1.0.0",
  category: "insight",
  summary: "Bar/line/pie chart grouping a data source by a field (optionally bucketed by day).",
  useWhen: ["Trends over time", "Breakdowns by category/status"],
  notFor: ["Single headline numbers (use metric-cards)"],
  requires: ["rbac"],
  emitsAudit: [],
  permissions: ["view"],
  configSchema,
  example: { source: "refunds", kind: "line", groupBy: "created_at", bucket: "day", agg: "sum", field: "amount", currency: true },
};
