import { z } from "zod";
import type { BlockManifest } from "../types";
import { columnSchema, conditionsSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string().describe("Data source name (see connectors)"),
  columns: z.array(columnSchema).min(1),
  where: conditionsSchema.optional().describe("Static filter always applied"),
  filters: z.array(z.object({ field: z.string(), label: z.string().optional(), options: z.array(z.string()) })).default([]),
  searchable: z.boolean().default(true),
  rowActions: z.array(z.string()).default([]).describe("Action ids from app.actions"),
  rowLink: z.string().optional().describe('Page path pattern, e.g. "refunds/:id"'),
  pageSize: z.number().int().min(5).max(200).default(25),
  exportable: z.boolean().default(false).describe("CSV export (requires the 'export' permission; audited)"),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "data-grid",
  version: "1.0.0",
  category: "data",
  summary: "Searchable, filterable table over a data source with row actions and audited CSV export.",
  useWhen: ["Browsing or searching a list of records", "Running an action on individual rows", "Exporting data for analysis"],
  notFor: ["Work that must be claimed and decided one item at a time (use review-queue)", "Boolean config grids (use toggle-matrix)"],
  requires: ["rbac", "pii-masking", "audit"],
  emitsAudit: ["data.exported", "action.<id>"],
  permissions: ["view", "export"],
  configSchema,
  example: {
    source: "refunds",
    columns: ["id", "customer_name", { field: "amount", format: "currency" }, "status"],
    filters: [{ field: "status", options: ["requested", "issued", "denied"] }],
    rowActions: ["issueRefund"],
    rowLink: "refunds/:id",
    exportable: true,
  },
};
