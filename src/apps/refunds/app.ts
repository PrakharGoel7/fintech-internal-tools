import { defineApp } from "@/platform";

export default defineApp({
  slug: "refunds",
  name: "Refunds Dashboard",
  description: "Issue Stripe refunds. Over $500 needs Finance approval.",
  icon: "💸",
  category: "finance",
  owners: ["finance-lead"],
  permissions: {
    view: ["support-agent", "ops-lead", "finance-lead"],
    request: ["support-agent", "ops-lead"],
    issue: ["ops-lead", "finance-lead"],
    "pii.reveal": ["finance-lead"],
    comment: ["support-agent", "ops-lead", "finance-lead"],
    export: ["finance-lead"],
  },
  actions: {
    requestRefund: {
      label: "Request refund", source: "refunds", permission: "request", variant: "primary",
      effect: { kind: "create", defaults: { status: "requested", currency: "USD", requested_by: "$user" } },
    },
    issueRefund: {
      label: "Issue refund", source: "refunds", permission: "issue", variant: "primary",
      effect: { kind: "connector", connector: "stripe", op: "refund" },
      reasonCodes: ["verified_duplicate", "service_credit", "fraud_confirmed", "goodwill"],
      availableWhen: [{ field: "status", op: "eq", value: "requested" }],
      approval: {
        when: [{ field: "amount", op: "gt", value: 500 }],
        approverRoles: ["finance-lead"],
        description: "Refunds over $500 require Finance Lead approval",
      },
    },
    denyRefund: {
      label: "Deny", source: "refunds", permission: "issue", variant: "danger",
      effect: { kind: "update", set: { status: "denied" } },
      reasonCodes: ["outside_policy", "chargeback_open", "suspected_abuse", "duplicate_request"],
      availableWhen: [{ field: "status", op: "eq", value: "requested" }],
    },
  },
  pages: [
    {
      id: "dashboard", title: "Dashboard", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "refunds",
            metrics: [
              { label: "Open requests", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "requested" }] },
              { label: "Refunded (30d)", agg: "sum", field: "amount", format: "currency", where: [{ field: "status", op: "eq", value: "issued" }] },
              { label: "Avg refund", agg: "avg", field: "amount", format: "currency", where: [{ field: "status", op: "eq", value: "issued" }] },
              { label: "Denied", agg: "count", where: [{ field: "status", op: "eq", value: "denied" }] },
            ],
          },
        },
        { type: "chart", width: "two-thirds", title: "Refunded $ per day", config: { source: "refunds", kind: "line", groupBy: "created_at", bucket: "day", agg: "sum", field: "amount", currency: true, where: [{ field: "status", op: "eq", value: "issued" }] } },
        { type: "chart", width: "third", title: "Requests by reason", config: { source: "refunds", kind: "pie", groupBy: "reason" } },
        {
          type: "data-grid",
          title: "Refund requests",
          config: {
            source: "refunds",
            columns: ["id", "customer_name", "email", { field: "amount", format: "currency" }, "reason", "status", "requested_by", { field: "created_at", format: "relative" }],
            filters: [{ field: "status", options: ["requested", "issued", "denied"] }, { field: "reason", options: ["duplicate_charge", "service_outage", "fraudulent", "customer_request", "billing_error"] }],
            rowActions: ["issueRefund", "denyRefund"],
            rowLink: "refunds/:id",
            exportable: true,
          },
        },
      ],
    },
    {
      id: "refund", title: "Refund", path: "refunds/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "refunds", fields: ["customer_name", "email", "charge_id", { field: "amount", format: "currency" }, "reason", "status", "stripe_refund_id", "requested_by", "created_at"], actions: ["issueRefund", "denyRefund"], backLink: "" } },
        { type: "audit-timeline", width: "third", title: "History", config: { scope: "record", source: "refunds" } },
        { type: "comments", config: { source: "refunds" } },
      ],
    },
    {
      id: "new", title: "New request", path: "new",
      blocks: [{
        type: "form", width: "half",
        config: {
          submitAction: "requestRefund", submitLabel: "Submit refund request",
          description: "Support agents file requests here; Ops/Finance issue them from the dashboard.",
          fields: [
            { name: "charge_id", label: "Stripe charge ID", required: true, placeholder: "ch_..." },
            { name: "customer_name", label: "Customer name", required: true },
            { name: "email", label: "Customer email", type: "email", required: true },
            { name: "amount", label: "Amount (USD)", type: "number", required: true },
            { name: "reason", label: "Reason", type: "select", required: true, options: ["duplicate_charge", "service_outage", "fraudulent", "customer_request", "billing_error"] },
          ],
        },
      }],
    },
  ],
});
