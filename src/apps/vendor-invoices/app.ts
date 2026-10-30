import { defineApp } from "@/platform";

const THRESHOLD = 25000;
const PENDING = [{ field: "status", op: "eq" as const, value: "pending_review" }];
const SUMMARY = ["vendor_name", "invoice_number", { field: "amount", format: "currency" as const }, { field: "due_date", format: "date" as const }];
const DETAIL = ["vendor_name", "invoice_number", { field: "amount", format: "currency" as const }, "currency", { field: "due_date", format: "date" as const }, "bank_account", "status", "entered_by", "approved_by", { field: "created_at", format: "datetime" as const }];

export default defineApp({
  slug: "vendor-invoices",
  name: "Vendor Invoice Approvals",
  description: "AP clerks enter vendor invoices and approve them for payment, reject them with a reason, or put them on hold. Invoices over $25,000 need Finance Lead approval.",
  icon: "🧾",
  category: "finance",
  owners: ["finance-lead"],
  permissions: {
    view: ["ap-clerk", "finance-lead"],
    enter: ["ap-clerk"],
    review: ["ap-clerk"],
    "pii.reveal": ["finance-lead"],
    comment: ["ap-clerk", "finance-lead"],
    export: ["finance-lead"],
  },
  actions: {
    enterInvoice: {
      label: "Enter invoice", source: "vendor_invoices", permission: "enter", variant: "primary",
      effect: { kind: "create", defaults: { status: "pending_review", currency: "USD", entered_by: "$user" } },
    },
    approve: {
      label: "Approve for payment", source: "vendor_invoices", permission: "review", variant: "primary",
      effect: { kind: "update", set: { status: "approved", approved_by: "$user" } },
      notBy: ["entered_by"],
      reasonCodes: ["matches_po", "goods_received", "contract_terms", "recurring_service"],
      availableWhen: PENDING,
      approval: {
        when: [{ field: "amount", op: "gt", value: THRESHOLD }],
        approverRoles: ["finance-lead"],
        description: "Invoices over $25,000 require Finance Lead approval",
      },
    },
    reject: {
      label: "Reject", source: "vendor_invoices", permission: "review", variant: "danger",
      effect: { kind: "update", set: { status: "rejected" } },
      reasonCodes: ["duplicate_invoice", "amount_mismatch", "no_matching_po", "unknown_vendor", "goods_not_received", "data_entry_error"],
      requireNote: true,
      availableWhen: PENDING,
    },
    hold: {
      label: "Put on hold", source: "vendor_invoices", permission: "review",
      effect: { kind: "update", set: { status: "on_hold" } },
      reasonCodes: ["awaiting_po", "awaiting_vendor_info", "bank_details_check", "amount_disputed"],
      requireNote: true,
      availableWhen: PENDING,
    },
    release: {
      label: "Release", source: "vendor_invoices", permission: "review",
      effect: { kind: "update", set: { status: "pending_review" } },
      reasonCodes: ["info_received", "issue_resolved"],
      availableWhen: [{ field: "status", op: "eq", value: "on_hold" }],
    },
  },
  pages: [
    {
      id: "queue", title: "Queue", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "vendor_invoices",
            metrics: [
              { label: "Pending review", agg: "count", tone: "warn", where: PENDING },
              { label: "Pending amount", agg: "sum", field: "amount", format: "currency", where: PENDING },
              { label: "Over $25,000 (Finance Lead)", agg: "count", where: [...PENDING, { field: "amount", op: "gt", value: THRESHOLD }] },
              { label: "On hold", agg: "count", where: [{ field: "status", op: "eq", value: "on_hold" }] },
            ],
          },
        },
        {
          type: "review-queue",
          title: "Invoices to review",
          config: {
            source: "vendor_invoices",
            openWhere: PENDING,
            decisionActions: ["approve", "reject", "hold"],
            summaryFields: SUMMARY,
            detailFields: DETAIL,
            sla: { field: "due_date", hours: 72, mode: "deadline" },
            badges: [{ when: [{ field: "amount", op: "gt", value: THRESHOLD }], label: "Needs Finance Lead", tone: "warn" }],
          },
        },
      ],
    },
    {
      id: "invoices", title: "All invoices", path: "invoices",
      blocks: [{
        type: "data-grid",
        title: "Vendor invoices",
        config: {
          source: "vendor_invoices",
          columns: ["vendor_name", "invoice_number", { field: "amount", format: "currency" }, { field: "due_date", format: "date" }, "status", "entered_by", "approved_by", { field: "created_at", format: "relative" }],
          filters: [{ field: "status", options: ["pending_review", "on_hold", "approved", "rejected"] }],
          rowActions: ["release"],
          rowLink: "invoices/:id",
          exportable: true,
        },
      }],
    },
    {
      id: "invoice", title: "Invoice", path: "invoices/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "vendor_invoices", fields: DETAIL, actions: ["approve", "reject", "hold", "release"], backLink: "invoices" } },
        { type: "audit-timeline", width: "third", title: "History", config: { scope: "record", source: "vendor_invoices" } },
        { type: "comments", config: { source: "vendor_invoices" } },
      ],
    },
    {
      id: "new", title: "New invoice", path: "new",
      blocks: [{
        type: "form", width: "half",
        config: {
          submitAction: "enterInvoice", submitLabel: "Enter invoice",
          description: "Enter an invoice received from a vendor. Another clerk reviews it; invoices over $25,000 also need a Finance Lead.",
          fields: [
            { name: "vendor_name", label: "Vendor name", required: true },
            { name: "invoice_number", label: "Invoice number", required: true, placeholder: "INV-..." },
            { name: "amount", label: "Amount (USD)", type: "number", required: true },
            { name: "due_date", label: "Due date", required: true, placeholder: "YYYY-MM-DD" },
            { name: "bank_account", label: "Vendor bank account (routing-account)", required: true },
          ],
        },
      }],
    },
  ],
});
