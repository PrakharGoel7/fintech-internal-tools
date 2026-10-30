import { z } from "zod";
import type { BlockManifest } from "../types";

export const configSchema = z.object({
  source: z.string(),
  labelField: z.string(),
  descriptionField: z.string().optional(),
  extraFields: z.array(z.string()).default([]),
  columns: z.array(z.object({ field: z.string(), label: z.string(), action: z.string().describe("Action (usually effect.kind=toggle) to flip this cell") })).min(1),
  rowLink: z.string().optional(),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "toggle-matrix",
  version: "1.0.1",
  category: "governance",
  summary: "Grid of on/off switches (rows × environments/regions) where each flip is a guarded, audited action — maker-checker per column.",
  useWhen: ["Feature flags per environment", "Per-region/product kill switches", "Entitlements matrices"],
  notFor: ["Free-form record editing (use form / record-detail)"],
  requires: ["rbac", "audit", "maker-checker"],
  emitsAudit: ["action.<id>", "approval.requested"],
  permissions: ["view"],
  configSchema,
  example: { source: "feature_flags", labelField: "id", descriptionField: "description", columns: [{ field: "enabled_dev", label: "Dev", action: "toggleDev" }, { field: "enabled_prod", label: "Prod", action: "toggleProd" }] },
};
