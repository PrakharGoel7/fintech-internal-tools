import { z } from "zod";
import type { BlockManifest } from "../types";

export const configSchema = z.object({
  submitAction: z.string().describe("Action with effect.kind=create"),
  submitLabel: z.string().default("Submit"),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "number", "select", "email"]).default("text"),
    options: z.array(z.string()).optional(),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
  })).min(1),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "form",
  version: "1.0.0",
  category: "input",
  summary: "Typed input form that creates a record through a guarded action (reason codes, maker-checker and audit apply).",
  useWhen: ["Submitting a new request/record (refund request, access request, incident)"],
  notFor: ["Editing many records (use data-grid row actions)"],
  requires: ["rbac", "audit", "maker-checker"],
  emitsAudit: ["action.<id>", "approval.requested"],
  permissions: [],
  configSchema,
  example: { submitAction: "requestRefund", fields: [{ name: "charge_id", label: "Charge ID", required: true }, { name: "amount", label: "Amount", type: "number", required: true }] },
};
