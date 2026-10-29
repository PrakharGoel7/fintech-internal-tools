import { z } from "zod";
import type { BlockManifest } from "../types";
import { columnSchema, conditionsSchema } from "../_shared/schema";

export const configSchema = z.object({
  source: z.string(),
  openWhere: conditionsSchema.describe("Which records are in the queue"),
  assigneeField: z.string().default("assignee"),
  claimAction: z.string().optional().describe("Action that assigns the item to the current user"),
  decisionActions: z.array(z.string()).min(1),
  summaryFields: z.array(columnSchema).min(1).describe("Shown in the queue list"),
  detailFields: z.array(columnSchema).min(1),
  sla: z.object({ field: z.string(), hours: z.number().positive() }).optional(),
  priorityField: z.string().optional().describe("Numeric field; higher = shown with a risk badge"),
  comments: z.boolean().default(true),
  history: z.boolean().default(true),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "review-queue",
  version: "1.0.0",
  category: "workflow",
  summary: "Claimable work queue with SLA timers, assignment, detail panel, decisions, comments and per-item audit history.",
  useWhen: ["Humans process items one at a time and record a decision (KYC, disputes, fraud alerts, content review)", "Work needs ownership and SLA tracking"],
  notFor: ["Read-only browsing (use data-grid)", "Bulk configuration (use toggle-matrix)"],
  requires: ["rbac", "pii-masking", "audit", "maker-checker"],
  emitsAudit: ["action.<claim>", "action.<decision>", "approval.requested", "comment.added", "pii.revealed"],
  permissions: ["view", "pii.reveal", "comment"],
  configSchema,
  example: {
    source: "kyc_cases",
    openWhere: [{ field: "status", op: "in", value: ["pending", "in_review"] }],
    claimAction: "claim",
    decisionActions: ["approve", "reject", "escalate"],
    summaryFields: ["customer_name", "country", "risk_score"],
    detailFields: ["customer_name", "email", "ssn_last4", "dob", "doc_type", "vendor_result"],
    sla: { field: "created_at", hours: 48 },
    priorityField: "risk_score",
  },
};
