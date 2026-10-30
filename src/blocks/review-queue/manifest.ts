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
  sla: z.object({
    field: z.string().describe("Timestamp field the timer is based on"),
    hours: z.number().positive().describe("elapsed: SLA length in hours. deadline: show a warning when fewer hours remain"),
    mode: z.enum(["elapsed", "deadline"]).default("elapsed").describe("elapsed: due = field + hours (e.g. created_at). deadline: field is an absolute due date (e.g. evidence_due_by)"),
  }).optional(),
  statusField: z.string().default("status"),
  badges: z.array(z.object({
    when: conditionsSchema,
    label: z.string(),
    tone: z.enum(["neutral", "info", "good", "warn", "bad", "accent"]).default("bad"),
  })).default([]).describe("Flags shown on queue items matching the conditions, e.g. high risk or high value"),
  comments: z.boolean().default(true),
  history: z.boolean().default(true),
});

export const manifest: BlockManifest<typeof configSchema> = {
  name: "review-queue",
  version: "2.0.1",
  category: "workflow",
  summary: "Claimable work queue with SLA timers or hard-deadline countdowns, assignment, detail panel, decisions, comments and per-item audit history.",
  useWhen: ["Humans process items one at a time and record a decision (KYC, disputes, fraud alerts, content review)", "Work needs ownership and SLA tracking", "Items have an external hard deadline (sla.mode = deadline)"],
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
    badges: [{ when: [{ field: "risk_score", op: "gt", value: 70 }], label: "High risk", tone: "bad" }],
  },
};
