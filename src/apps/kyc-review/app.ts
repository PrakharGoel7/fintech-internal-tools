import { defineApp } from "@/platform";

export default defineApp({
  slug: "kyc-review",
  name: "KYC Review Queue",
  description: "Review identity checks. High-risk approvals need Compliance.",
  icon: "🪪",
  category: "compliance",
  owners: ["ops-lead"],
  permissions: {
    view: ["ops-analyst", "ops-lead", "compliance"],
    decide: ["ops-analyst", "ops-lead", "compliance"],
    "pii.reveal": ["ops-lead", "compliance"],
    comment: ["ops-analyst", "ops-lead", "compliance"],
    export: ["compliance"],
  },
  actions: {
    claim: {
      label: "Claim", source: "kyc_cases", permission: "decide",
      effect: { kind: "update", set: { assignee: "$user", status: "in_review" } },
      availableWhen: [{ field: "status", op: "in", value: ["pending", "in_review"] }],
    },
    approve: {
      label: "Approve", source: "kyc_cases", permission: "decide", variant: "primary",
      effect: { kind: "update", set: { status: "approved" } },
      reasonCodes: ["documents_verified", "low_risk_profile", "manual_override"],
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
      approval: {
        when: [{ field: "risk_score", op: "gt", value: 70 }],
        approverRoles: ["compliance"],
        description: "High-risk cases (risk score > 70) need Compliance sign-off",
      },
    },
    reject: {
      label: "Reject", source: "kyc_cases", permission: "decide", variant: "danger",
      effect: { kind: "update", set: { status: "rejected" } },
      reasonCodes: ["document_mismatch", "sanctions_match", "fraud_suspected", "incomplete_submission"],
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
    },
    escalate: {
      label: "Escalate", source: "kyc_cases", permission: "decide",
      effect: { kind: "handler", name: "escalateToCompliance" },
      requireNote: true,
      availableWhen: [{ field: "status", op: "in", value: ["pending", "in_review"] }],
    },
    rescreen: {
      label: "Re-run vendor screening", source: "kyc_cases", permission: "decide",
      effect: { kind: "connector", connector: "kycVendor", op: "rescreen" },
      availableWhen: [{ field: "status", op: "in", value: ["pending", "in_review", "escalated"] }],
    },
  },
  pages: [
    {
      id: "queue", title: "Queue", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "kyc_cases",
            metrics: [
              { label: "Awaiting review", agg: "count", where: [{ field: "status", op: "in", value: ["pending", "in_review"] }] },
              { label: "High risk open", agg: "count", tone: "bad", where: [{ field: "status", op: "in", value: ["pending", "in_review"] }, { field: "risk_score", op: "gt", value: 70 }] },
              { label: "Escalated", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "escalated" }] },
              { label: "Approved", agg: "count", tone: "good", where: [{ field: "status", op: "eq", value: "approved" }] },
            ],
          },
        },
        {
          type: "review-queue",
          title: "Verification queue",
          config: {
            source: "kyc_cases",
            openWhere: [{ field: "status", op: "in", value: ["pending", "in_review"] }],
            claimAction: "claim",
            decisionActions: ["approve", "reject", "escalate", "rescreen"],
            summaryFields: ["customer_name", "country", { field: "risk_score", label: "Risk" }],
            detailFields: ["customer_name", "email", "ssn_last4", "dob", "country", "doc_type", "risk_score", "vendor_result", "assignee"],
            sla: { field: "created_at", hours: 72 },
            badges: [{ when: [{ field: "risk_score", op: "gt", value: 70 }], label: "High risk", tone: "bad" }],
          },
        },
      ],
    },
    {
      id: "all", title: "All cases", path: "cases",
      blocks: [{
        type: "data-grid",
        config: {
          source: "kyc_cases",
          columns: ["id", "customer_name", "country", "doc_type", "risk_score", "vendor_result", "status", "assignee", { field: "created_at", format: "relative" }],
          filters: [
            { field: "status", options: ["pending", "in_review", "approved", "rejected", "escalated"] },
            { field: "vendor_result", options: ["clear", "needs_review", "watchlist_hit"] },
          ],
          rowLink: "cases/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "case", title: "Case", path: "cases/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "kyc_cases", fields: ["customer_name", "email", "ssn_last4", "dob", "country", "doc_type", "risk_score", "vendor_result", "status", "assignee", "created_at"], actions: ["claim", "approve", "reject", "escalate"], backLink: "cases" } },
        { type: "audit-timeline", width: "third", title: "Case history", config: { scope: "record", source: "kyc_cases" } },
        { type: "comments", config: { source: "kyc_cases" } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
  handlers: {
    /** Rung-3 customization: app-local logic that no block config could express. */
    escalateToCompliance: ({ record }) => ({
      status: "escalated",
      assignee: Number(record?.risk_score) > 70 ? "carol" : "bob",
    }),
  },
});
