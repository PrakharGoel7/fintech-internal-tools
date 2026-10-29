import { defineApp } from "@/platform";

const OPEN = ["pending", "in_review"];
const DECIDED = ["approved", "rejected"];
const TIERS = ["low", "medium", "high"] as const;

export default defineApp({
  slug: "merchant-onboarding",
  name: "Merchant Onboarding Review",
  description: "Review new merchant applications: claim, approve, reject or request more info with a reason code. High-risk approvals need Compliance sign-off.",
  icon: "🏪",
  category: "compliance",
  owners: ["ops-lead"],
  permissions: {
    view: ["ops-analyst", "ops-lead", "compliance"],
    decide: ["ops-analyst", "ops-lead"],
    "pii.reveal": ["ops-lead", "compliance"],
    comment: ["ops-analyst", "ops-lead", "compliance"],
    export: ["compliance"],
  },
  actions: {
    claim: {
      label: "Claim", source: "merchant_applications", permission: "decide",
      effect: { kind: "update", set: { assignee: "$user", status: "in_review" } },
      availableWhen: [{ field: "status", op: "in", value: OPEN }],
    },
    approve: {
      label: "Approve", source: "merchant_applications", permission: "decide", variant: "primary",
      effect: { kind: "update", set: { status: "approved" } },
      reasonCodes: ["kyb_verified", "low_risk_profile", "acceptable_mcc", "compliance_reviewed", "manual_override"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
      approval: {
        when: [{ field: "risk_tier", op: "eq", value: "high" }],
        approverRoles: ["compliance"],
        description: "Approving a high-risk merchant requires Compliance sign-off",
      },
    },
    reject: {
      label: "Reject", source: "merchant_applications", permission: "decide", variant: "danger",
      effect: { kind: "update", set: { status: "rejected" } },
      reasonCodes: ["prohibited_mcc", "sanctions_or_watchlist", "fraud_suspected", "unverifiable_business", "excessive_risk", "incomplete_application"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
    },
    requestInfo: {
      label: "Request more info", source: "merchant_applications", permission: "decide",
      effect: { kind: "update", set: { status: "needs_info" } },
      reasonCodes: ["missing_documents", "ownership_unclear", "volume_unsubstantiated", "business_model_unclear", "other"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
    },
    resume: {
      label: "Resume review", source: "merchant_applications", permission: "decide",
      effect: { kind: "update", set: { assignee: "$user", status: "in_review" } },
      reasonCodes: ["merchant_responded"],
      availableWhen: [{ field: "status", op: "eq", value: "needs_info" }],
    },
  },
  pages: [
    {
      id: "queue", title: "Queue", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "merchant_applications",
            metrics: [
              { label: "Pending", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "pending" }] },
              { label: "In review", agg: "count", where: [{ field: "status", op: "eq", value: "in_review" }] },
              { label: "Needs info", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "needs_info" }] },
              { label: "High risk open (Compliance to approve)", agg: "count", tone: "bad", where: [{ field: "status", op: "in", value: OPEN }, { field: "risk_tier", op: "eq", value: "high" }] },
            ],
          },
        },
        {
          type: "review-queue",
          title: "Applications awaiting review",
          config: {
            source: "merchant_applications",
            openWhere: [{ field: "status", op: "in", value: OPEN }],
            claimAction: "claim",
            decisionActions: ["approve", "reject", "requestInfo"],
            summaryFields: ["legal_name", "country", "risk_tier", { field: "expected_monthly_volume", format: "currency" }],
            detailFields: ["legal_name", "contact_name", "contact_email", "country", "mcc", { field: "expected_monthly_volume", format: "currency" }, "risk_tier", "assignee", { field: "submitted_at", format: "datetime" }],
            sla: { field: "submitted_at", hours: 72 },
            badges: [{ when: [{ field: "risk_tier", op: "eq", value: "high" }], label: "High risk · Compliance sign-off", tone: "bad" }],
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
            source: "merchant_applications",
            metrics: [
              { label: "Pending applications", agg: "count", tone: "warn", where: [{ field: "status", op: "in", value: OPEN }] },
              { label: "Needs info", agg: "count", where: [{ field: "status", op: "eq", value: "needs_info" }] },
              { label: "Approved", agg: "count", tone: "good", where: [{ field: "status", op: "eq", value: "approved" }] },
              { label: "Rejected", agg: "count", tone: "bad", where: [{ field: "status", op: "eq", value: "rejected" }] },
            ],
          },
        },
        { type: "chart", width: "half", title: "Pending applications by risk tier", config: { source: "merchant_applications", kind: "bar", groupBy: "risk_tier", where: [{ field: "status", op: "in", value: OPEN }] } },
        { type: "chart", width: "half", title: "Applications by status", config: { source: "merchant_applications", kind: "pie", groupBy: "status" } },
        // TODO(GAPS.md "Ratio metrics"): replace these per-tier decision counts with one "approval rate by risk tier"
        // chart once the generic ratio option lands in chart / metric-cards.
        ...TIERS.map((tier) => ({
          type: "chart",
          width: "third" as const,
          title: `Decisions: ${tier} risk (approved vs rejected)`,
          config: { source: "merchant_applications", kind: "bar", groupBy: "status", where: [{ field: "risk_tier", op: "eq", value: tier }, { field: "status", op: "in", value: DECIDED }] },
        })),
      ],
    },
    {
      id: "all", title: "All applications", path: "applications",
      blocks: [{
        type: "data-grid",
        config: {
          source: "merchant_applications",
          columns: ["id", "legal_name", "contact_name", "contact_email", "country", "mcc", { field: "expected_monthly_volume", format: "currency" }, "risk_tier", "status", "assignee", { field: "submitted_at", format: "relative" }],
          filters: [
            { field: "status", options: ["pending", "in_review", "needs_info", "approved", "rejected"] },
            { field: "risk_tier", options: [...TIERS] },
            { field: "country", options: ["US", "GB", "CA", "DE", "MX", "SG", "NG", "AE"] },
          ],
          rowLink: "applications/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "application", title: "Application", path: "applications/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "merchant_applications", fields: ["legal_name", "contact_name", "contact_email", "country", "mcc", { field: "expected_monthly_volume", format: "currency" }, "risk_tier", "status", "assignee", { field: "submitted_at", format: "datetime" }, { field: "updated_at", format: "datetime" }], actions: ["claim", "approve", "reject", "requestInfo", "resume"], backLink: "applications" } },
        { type: "audit-timeline", width: "third", title: "Decision history", config: { scope: "record", source: "merchant_applications" } },
        { type: "comments", config: { source: "merchant_applications" } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
});
