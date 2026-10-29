import { defineApp } from "@/platform";

const source = "customer_accounts";

export default defineApp({
  slug: "limit-overrides",
  name: "Customer Limit Overrides",
  description: "Request, approve and revoke temporary daily transfer-limit increases. Every override needs a second approver; above $25,000/day needs Compliance.",
  icon: "🎚️",
  category: "operations",
  owners: ["ops-lead"],
  permissions: {
    view: ["support-agent", "ops-lead", "compliance", "engineer", "eng-lead"],
    request: ["support-agent"],
    revoke: ["support-agent", "ops-lead", "compliance"],
    "pii.reveal": ["support-agent", "ops-lead", "compliance"],
    comment: ["support-agent", "ops-lead", "compliance"],
    export: ["compliance"],
  },
  actions: {
    requestOverride: {
      label: "Request override", source, permission: "request", variant: "primary",
      effect: { kind: "connector", connector: "coreBanking", op: "applyLimitOverride" },
      inputs: [
        { field: "override_limit", label: "New daily limit (USD)", type: "number" },
        { field: "override_expiry", label: "Expires on (max 30 days)", type: "date" },
      ],
      reasonCodes: ["large_purchase", "property_closing", "payroll_run", "business_payment", "other"],
      requireNote: true,
      availableWhen: [{ field: "override_status", op: "in", value: ["none", "expired", "rejected"] }],
      approval: [
        {
          when: [{ field: "override_limit", op: "gt", value: 25000 }],
          approverRoles: ["compliance"],
          description: "Overrides above $25,000/day need Compliance approval",
        },
        {
          when: [],
          approverRoles: ["ops-lead", "compliance"],
          description: "Every override needs a second approver",
        },
      ],
      statusField: "override_status", pendingStatus: "requested", rejectedStatus: "rejected",
    },
    revokeOverride: {
      label: "Revoke", source, permission: "revoke", variant: "danger",
      effect: { kind: "connector", connector: "coreBanking", op: "revokeLimitOverride" },
      reasonCodes: ["customer_request", "no_longer_needed", "fraud_suspected", "entered_in_error"],
      availableWhen: [{ field: "override_status", op: "eq", value: "active" }],
    },
    expireOverride: {
      label: "Mark expired", source, permission: "revoke",
      effect: { kind: "update", set: { override_status: "expired" } },
      reasonCodes: ["expiry_reached"],
      availableWhen: [{ field: "override_status", op: "eq", value: "active" }],
    },
  },
  pages: [
    {
      id: "active", title: "Active overrides", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source,
            metrics: [
              { label: "Active overrides", agg: "count", tone: "good", where: [{ field: "override_status", op: "eq", value: "active" }] },
              { label: "Awaiting approval", agg: "count", tone: "warn", where: [{ field: "override_status", op: "eq", value: "requested" }] },
              { label: "Active above $25k/day", agg: "count", tone: "bad", where: [{ field: "override_status", op: "eq", value: "active" }, { field: "override_limit", op: "gt", value: 25000 }] },
              { label: "Total active override limit", agg: "sum", field: "override_limit", format: "currency", where: [{ field: "override_status", op: "eq", value: "active" }] },
            ],
          },
        },
        {
          type: "data-grid",
          title: "Active overrides",
          config: {
            source,
            where: [{ field: "override_status", op: "eq", value: "active" }],
            columns: ["id", "customer_name", { field: "daily_limit", format: "currency" }, { field: "override_limit", format: "currency" }, { field: "override_expiry", format: "date" }, "override_status"],
            rowActions: ["revokeOverride", "expireOverride"],
            rowLink: "accounts/:id",
            exportable: true,
          },
        },
      ],
    },
    {
      id: "accounts", title: "Accounts", path: "accounts",
      blocks: [{
        type: "data-grid",
        config: {
          source,
          columns: ["id", "customer_name", "email", { field: "daily_limit", format: "currency" }, { field: "override_limit", format: "currency" }, { field: "override_expiry", format: "date" }, "override_status"],
          filters: [{ field: "override_status", options: ["none", "requested", "active", "expired", "rejected"] }],
          rowActions: ["requestOverride", "revokeOverride"],
          rowLink: "accounts/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "account", title: "Account", path: "accounts/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source, fields: ["id", "customer_name", "email", "daily_limit", "override_limit", "override_expiry", "override_status", "created_at"], actions: ["requestOverride", "revokeOverride", "expireOverride"], backLink: "accounts" } },
        { type: "audit-timeline", width: "third", title: "Override history", config: { scope: "record", source } },
        { type: "comments", config: { source } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
});
