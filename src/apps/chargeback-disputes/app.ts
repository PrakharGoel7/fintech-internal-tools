import { defineApp } from "@/platform";

const OPEN = ["needs_response", "under_review"];
const REASONS = ["fraudulent", "product_not_received", "duplicate", "subscription_canceled", "unrecognized"];

export default defineApp({
  slug: "chargeback-disputes",
  name: "Chargeback Dispute Queue",
  description: "Work Stripe chargebacks before the evidence deadline: claim, contest with evidence, or accept. Write-offs over $1,000 need Finance Lead sign-off.",
  icon: "⚖️",
  category: "operations",
  owners: ["ops-lead"],
  permissions: {
    view: ["ops-analyst", "ops-lead", "finance-lead"],
    work: ["ops-analyst", "ops-lead"],
    "pii.reveal": ["ops-lead"],
    comment: ["ops-analyst", "ops-lead", "finance-lead"],
    export: ["ops-lead", "finance-lead"],
  },
  actions: {
    claim: {
      label: "Claim", source: "disputes", permission: "work",
      effect: { kind: "update", set: { assignee: "$user" } },
      availableWhen: [{ field: "status", op: "eq", value: "needs_response" }],
    },
    contest: {
      label: "Submit evidence", source: "disputes", permission: "work", variant: "primary",
      effect: { kind: "connector", connector: "stripe", op: "submitDisputeEvidence" },
      reasonCodes: ["proof_of_delivery", "customer_communication", "usage_or_access_logs", "refund_or_cancellation_policy", "duplicate_charge_proof", "receipt_or_invoice"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "needs_response" }],
    },
    accept: {
      label: "Accept (write off)", source: "disputes", permission: "work", variant: "danger",
      effect: { kind: "connector", connector: "stripe", op: "acceptDispute" },
      reasonCodes: ["insufficient_evidence", "customer_claim_valid", "cost_exceeds_recovery", "merchant_error"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "needs_response" }],
      approval: {
        when: [{ field: "amount", op: "gt", value: 1000 }],
        approverRoles: ["finance-lead"],
        description: "Writing off a dispute over $1,000 requires Finance Lead approval",
      },
    },
  },
  pages: [
    {
      id: "queue", title: "Queue", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "disputes",
            metrics: [
              { label: "Needs response", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "needs_response" }] },
              { label: "Amount at risk", agg: "sum", field: "amount", format: "currency", tone: "bad", where: [{ field: "status", op: "in", value: OPEN }] },
              { label: "Over $1,000 (Finance to accept)", agg: "count", where: [{ field: "status", op: "eq", value: "needs_response" }, { field: "amount", op: "gt", value: 1000 }] },
              { label: "Under review", agg: "count", where: [{ field: "status", op: "eq", value: "under_review" }] },
            ],
          },
        },
        {
          type: "review-queue",
          title: "Disputes needing a response",
          config: {
            source: "disputes",
            openWhere: [{ field: "status", op: "eq", value: "needs_response" }],
            claimAction: "claim",
            decisionActions: ["contest", "accept"],
            summaryFields: [{ field: "amount", format: "currency" }, "reason", "card_network"],
            detailFields: ["charge_id", "customer_name", "customer_email", { field: "amount", format: "currency" }, "card_network", "reason", { field: "evidence_due_by", format: "datetime" }, "assignee", { field: "created_at", format: "datetime" }],
            sla: { field: "evidence_due_by", hours: 48, mode: "deadline" },
          },
        },
      ],
    },
    {
      id: "dashboard", title: "Dashboard", path: "dashboard",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "disputes",
            metrics: [
              { label: "Open disputes", agg: "count", tone: "warn", where: [{ field: "status", op: "in", value: OPEN }] },
              { label: "Amount at risk", agg: "sum", field: "amount", format: "currency", tone: "bad", where: [{ field: "status", op: "in", value: OPEN }] },
              { label: "Won", agg: "count", tone: "good", where: [{ field: "status", op: "eq", value: "won" }] },
              { label: "Lost / accepted", agg: "count", where: [{ field: "status", op: "in", value: ["lost", "accepted"] }] },
            ],
          },
        },
        { type: "chart", width: "half", title: "Win rate by reason (%, decided disputes)", config: { source: "disputes", kind: "bar", groupBy: "reason", agg: "avg", field: "win_pct", where: [{ field: "status", op: "in", value: ["won", "lost"] }] } },
        { type: "chart", width: "half", title: "Amount at risk by reason", config: { source: "disputes", kind: "bar", groupBy: "reason", agg: "sum", field: "amount", currency: true, where: [{ field: "status", op: "in", value: OPEN }] } },
        { type: "chart", width: "half", title: "Disputes by status", config: { source: "disputes", kind: "pie", groupBy: "status" } },
        { type: "chart", width: "half", title: "Open disputes by card network", config: { source: "disputes", kind: "pie", groupBy: "card_network", where: [{ field: "status", op: "in", value: OPEN }] } },
      ],
    },
    {
      id: "all", title: "All disputes", path: "disputes",
      blocks: [{
        type: "data-grid",
        config: {
          source: "disputes",
          columns: ["id", "charge_id", "customer_name", "customer_email", { field: "amount", format: "currency" }, "card_network", "reason", { field: "evidence_due_by", format: "datetime" }, "status", "assignee"],
          filters: [
            { field: "status", options: ["needs_response", "under_review", "won", "lost", "accepted"] },
            { field: "reason", options: REASONS },
            { field: "card_network", options: ["visa", "mastercard", "amex", "discover"] },
          ],
          rowLink: "disputes/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "dispute", title: "Dispute", path: "disputes/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "disputes", fields: ["charge_id", "customer_name", "customer_email", { field: "amount", format: "currency" }, "card_network", "reason", { field: "evidence_due_by", format: "datetime" }, "status", "assignee", "evidence_submission_id", { field: "created_at", format: "datetime" }], actions: ["claim", "contest", "accept"], backLink: "disputes" } },
        { type: "audit-timeline", width: "third", title: "Decision history", config: { scope: "record", source: "disputes" } },
        { type: "comments", config: { source: "disputes" } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
});
