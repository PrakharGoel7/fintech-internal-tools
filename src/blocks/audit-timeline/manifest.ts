import { z } from "zod";
import type { BlockManifest } from "../types";

export const configSchema = z.object({
  scope: z.enum(["app", "record"]).default("app"),
  source: z.string().optional(),
  idParam: z.string().default("id"),
  limit: z.number().int().min(1).max(200).default(25),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "audit-timeline",
  version: "1.0.0",
  category: "governance",
  summary: "Read-only view of the tamper-evident audit log, scoped to the app or to one record.",
  useWhen: ["Showing who did what (record history, app activity feed)"],
  notFor: ["Editable notes (use comments)"],
  requires: ["audit"],
  emitsAudit: [],
  permissions: ["view"],
  configSchema,
  example: { scope: "record", source: "refunds", idParam: "id" },
};
