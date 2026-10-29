import { defineApp } from "@/platform";

const OPEN = ["mismatch", "investigating"];
const LAST_30D = { field: "payout_date", op: "gte", value: "$now-30d" } as const;
const OVER_LIMIT = [{ field: "difference_abs", op: "gt", value: 250 }] as const;
const FINANCE_APPROVAL = (what: string) => ({
  when: [...OVER_LIMIT],
  approverRoles: ["finance-lead" as const],
  description: `${what} over $250 requires Finance Lead approval`,
});

export default defineApp({
  slug: "payout-reconciliation",
  name: "Payout Reconciliation",
  description: "Reconcile daily Stripe payouts against bank deposits: track the matched rate, work mismatches, resolve or write off differences. Write-offs and fee/FX resolutions over $250 need Finance Lead approval.",
  icon: "🏦",
  category: "finance",
  owners: ["finance-lead"],
  permissions: {
    view: ["finance-lead", "ops-analyst", "engineer", "eng-lead"],
    work: ["finance-lead", "ops-analyst"],
    comment: ["finance-lead", "ops-analyst"],
    export: ["finance-lead"],
  },
  actions: {
    investigate: {
      label: "Mark investigating", source: "payouts", permission: "work",
      effect: { kind: "update", set: { status: "investigating", assignee: "$user" } },
      availableWhen: [{ field: "status", op: "eq", value: "mismatch" }],
    },
    resolveTiming: {
      label: "Resolve: timing", source: "payouts", permission: "work", variant: "primary",
      effect: { kind: "update", set: { status: "resolved", resolution: "timing" } },
      requireNote: true,
      availableWhen: [{ field: "status", op: "in", value: OPEN }],
    },
    resolveBankFee: {
      label: "Resolve: bank fee", source: "payouts", permission: "work",
      effect: { kind: "update", set: { status: "resolved", resolution: "bank_fee" } },
      requireNote: true,
      availableWhen: [{ field: "status", op: "in", value: OPEN }],
      approval: FINANCE_APPROVAL("Resolving a bank-fee difference"),
    },
    resolveFx: {
      label: "Resolve: FX", source: "payouts", permission: "work",
      effect: { kind: "update", set: { status: "resolved", resolution: "fx" } },
      requireNote: true,
      availableWhen: [{ field: "status", op: "in", value: OPEN }],
      approval: FINANCE_APPROVAL("Resolving an FX difference"),
    },
    writeOff: {
      label: "Write off difference", source: "payouts", permission: "work", variant: "danger",
      effect: { kind: "connector", connector: "ledger", op: "postWriteOff" },
      reasonCodes: ["unrecoverable", "below_recovery_cost", "unidentified_deduction", "duplicate_or_error"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "in", value: OPEN }],
      approval: FINANCE_APPROVAL("Writing off a difference"),
    },
  },
  pages: [
    {
      id: "dashboard", title: "Dashboard", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "payouts",
            metrics: [
              { label: "Matched rate (30d)", agg: "ratio", numerator: [{ field: "status", op: "eq", value: "matched" }], where: [LAST_30D], format: "percent", tone: "good" },
              { label: "Unreconciled amount (30d)", agg: "sum", field: "difference_abs", format: "currency", tone: "bad", where: [LAST_30D, { field: "status", op: "in", value: OPEN }] },
              { label: "Open mismatches", agg: "count", tone: "warn", where: [{ field: "status", op: "in", value: OPEN }] },
              { label: "Over $250 (Finance approval)", agg: "count", where: [{ field: "status", op: "in", value: OPEN }, ...OVER_LIMIT] },
            ],
          },
        },
        { type: "chart", width: "two-thirds", title: "Unreconciled $ by payout date (30d)", config: { source: "payouts", kind: "bar", groupBy: "payout_date", bucket: "day", agg: "sum", field: "difference_abs", currency: true, where: [LAST_30D, { field: "status", op: "in", value: OPEN }] } },
        { type: "chart", width: "third", title: "Payouts by status (30d)", config: { source: "payouts", kind: "pie", groupBy: "status", where: [LAST_30D] } },
        { type: "chart", width: "half", title: "Matched rate by day (%, 30d)", config: { source: "payouts", kind: "line", groupBy: "payout_date", bucket: "day", agg: "ratio", numerator: [{ field: "status", op: "eq", value: "matched" }], where: [LAST_30D] } },
        { type: "chart", width: "half", title: "Closed differences by resolution ($, 30d)", config: { source: "payouts", kind: "bar", groupBy: "resolution", agg: "sum", field: "difference_abs", currency: true, where: [LAST_30D, { field: "status", op: "in", value: ["resolved", "written_off"] }] } },
      ],
    },
    {
      id: "mismatches", title: "Mismatches", path: "mismatches",
      blocks: [{
        type: "review-queue",
        title: "Mismatches to work",
        config: {
          source: "payouts",
          openWhere: [{ field: "status", op: "in", value: OPEN }],
          claimAction: "investigate",
          decisionActions: ["resolveTiming", "resolveBankFee", "resolveFx", "writeOff"],
          summaryFields: [{ field: "difference", format: "currency" }, { field: "payout_date", format: "date" }, "bank_reference"],
          detailFields: [{ field: "payout_date", format: "date" }, { field: "expected_amount", format: "currency" }, { field: "received_amount", format: "currency" }, { field: "difference", format: "currency" }, "bank_reference", "status", "assignee"],
          sla: { field: "payout_date", hours: 72 },
          badges: [
            { when: [...OVER_LIMIT], label: "Over $250: Finance approval", tone: "bad" },
            { when: [{ field: "received_amount", op: "eq", value: 0 }], label: "No deposit", tone: "warn" },
            { when: [{ field: "difference", op: "gt", value: 0 }], label: "Overpaid", tone: "info" },
          ],
        },
      }],
    },
    {
      id: "all", title: "All payouts", path: "payouts",
      blocks: [{
        type: "data-grid",
        config: {
          source: "payouts",
          columns: ["id", { field: "payout_date", format: "date" }, { field: "expected_amount", format: "currency" }, { field: "received_amount", format: "currency" }, { field: "difference", format: "currency" }, "bank_reference", "status", "resolution", "assignee", "journal_entry_id"],
          filters: [
            { field: "status", options: ["matched", "mismatch", "investigating", "resolved", "written_off"] },
            { field: "resolution", options: ["timing", "bank_fee", "fx", "write_off"] },
          ],
          rowLink: "payouts/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "payout", title: "Payout", path: "payouts/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "payouts", fields: [{ field: "payout_date", format: "date" }, "currency", { field: "expected_amount", format: "currency" }, { field: "received_amount", format: "currency" }, { field: "difference", format: "currency" }, "bank_reference", "status", "resolution", "assignee", "journal_entry_id", { field: "created_at", format: "datetime" }], actions: ["investigate", "resolveTiming", "resolveBankFee", "resolveFx", "writeOff"], backLink: "payouts" } },
        { type: "audit-timeline", width: "third", title: "Reconciliation history", config: { scope: "record", source: "payouts" } },
        { type: "comments", config: { source: "payouts" } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
});
