import { z } from "zod";
import type { BlockManifest } from "../types";

export const configSchema = z.object({
  source: z.string(),
  idParam: z.string().default("id"),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "comments",
  version: "1.0.0",
  category: "collaboration",
  summary: "Threaded internal notes on a record (author + timestamp, audited).",
  useWhen: ["Reviewers need to leave context on a case/record"],
  notFor: ["System history (use audit-timeline)"],
  requires: ["rbac", "audit"],
  emitsAudit: ["comment.added"],
  permissions: ["comment"],
  configSchema,
  example: { source: "kyc_cases", idParam: "id" },
};
