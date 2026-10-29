import { z } from "zod";
import type { BlockManifest } from "../types";
import { columnSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string(),
  idParam: z.string().default("id").describe("Route param holding the record id"),
  fields: z.array(columnSchema).min(1),
  actions: z.array(z.string()).default([]),
  backLink: z.string().optional().describe('Page path to go back to, e.g. "" for app home'),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "record-detail",
  version: "1.0.0",
  category: "data",
  summary: "Single-record view with PII masking + audited reveal and guarded actions.",
  useWhen: ["Showing all fields of one record", "Taking actions on a specific record"],
  notFor: ["Lists (use data-grid)"],
  requires: ["rbac", "pii-masking", "audit"],
  emitsAudit: ["pii.revealed", "action.<id>"],
  permissions: ["view", "pii.reveal"],
  configSchema,
  example: { source: "refunds", fields: ["id", "customer_name", "email", { field: "amount", format: "currency" }, "status"], actions: ["issueRefund", "denyRefund"], backLink: "" },
};
