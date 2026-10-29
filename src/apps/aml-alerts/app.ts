import { defineApp } from "@/platform";

const FP_REASONS = ["expected_customer_activity", "known_counterparty", "duplicate_alert", "rule_misfire", "data_quality_issue"];
const OVER_10K = [{ field: "amount", op: "gt" as const, value: 10000 }];

export default defineApp({
  slug: "aml-alerts",
  name: "Transaction Monitoring Alerts",
  description: "Triage transaction-monitoring alerts: claim, close false positives, escalate to Compliance and file SARs with four-eyes approval.",
  icon: "🚨",
  category: "compliance",
  owners: ["compliance"],
  permissions: {
    view: ["aml-analyst", "compliance"],
    triage: ["aml-analyst", "compliance"],
    sar: ["compliance"],
    "pii.reveal": ["compliance"],
    comment: ["aml-analyst", "compliance"],
    export: ["compliance"],
  },
  actions: {
    claim: {
      label: "Claim", source: "aml_alerts", permission: "triage",
      effect: { kind: "update", set: { assignee: "$user", status: "in_review" } },
      availableWhen: [{ field: "status", op: "eq", value: "new" }],
    },
    closeFalsePositive: {
      label: "Close as false positive", source: "aml_alerts", permission: "triage", variant: "primary",
      effect: { kind: "update", set: { status: "closed_false_positive" } },
      reasonCodes: FP_REASONS,
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
      approval: {
        when: OVER_10K,
        approverRoles: ["compliance"],
        description: "Closing an alert over $10,000 as a false positive needs a Compliance Officer",
      },
    },
    escalate: {
      label: "Escalate to compliance", source: "aml_alerts", permission: "triage", variant: "danger",
      effect: { kind: "update", set: { status: "escalated", assignee: null } },
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "in_review" }],
    },
    takeEscalation: {
      label: "Take escalation", source: "aml_alerts", permission: "sar",
      effect: { kind: "update", set: { assignee: "$user" } },
      availableWhen: [{ field: "status", op: "eq", value: "escalated" }],
    },
    fileSar: {
      label: "File SAR", source: "aml_alerts", permission: "sar", variant: "danger",
      effect: { kind: "connector", connector: "regulatoryFiling", op: "fileSar" },
      reasonCodes: ["structuring", "money_laundering", "fraud", "terrorist_financing", "sanctions_evasion", "other"],
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "escalated" }],
      approval: {
        when: [],
        approverRoles: ["compliance"],
        description: "Every SAR filing needs a second Compliance Officer",
      },
    },
    closeNoSar: {
      label: "Close — no SAR", source: "aml_alerts", permission: "sar",
      effect: { kind: "update", set: { status: "closed_false_positive" } },
      reasonCodes: FP_REASONS,
      requireNote: true,
      availableWhen: [{ field: "status", op: "eq", value: "escalated" }],
      approval: {
        when: OVER_10K,
        approverRoles: ["compliance"],
        description: "Closing an alert over $10,000 without a SAR needs another Compliance Officer",
      },
    },
  },
  pages: [
    {
      id: "triage", title: "Triage", path: "",
      blocks: [
        {
          type: "metric-cards",
          config: {
            source: "aml_alerts",
            metrics: [
              { label: "New", agg: "count", where: [{ field: "status", op: "eq", value: "new" }] },
              { label: "In review", agg: "count", where: [{ field: "status", op: "eq", value: "in_review" }] },
              { label: "Escalated", agg: "count", tone: "warn", where: [{ field: "status", op: "eq", value: "escalated" }] },
              { label: "Open over $10k", agg: "count", tone: "bad", where: [{ field: "status", op: "in", value: ["new", "in_review", "escalated"] }, ...OVER_10K] },
            ],
          },
        },
        {
          type: "review-queue",
          title: "Triage queue",
          config: {
            source: "aml_alerts",
            openWhere: [{ field: "status", op: "in", value: ["new", "in_review"] }],
            claimAction: "claim",
            decisionActions: ["closeFalsePositive", "escalate"],
            summaryFields: ["rule", { field: "amount", format: "currency" }, { field: "risk_score", label: "Risk" }],
            detailFields: ["customer_name", "customer_email", "account_number", { field: "amount", format: "currency" }, "rule", "risk_score", "alert_date", "assignee"],
            sla: { field: "alert_date", hours: 72 },
            badges: [
              { when: [{ field: "risk_score", op: "gte", value: 80 }], label: "High risk", tone: "bad" },
              { when: OVER_10K, label: "Over $10k", tone: "warn" },
            ],
          },
        },
      ],
    },
    {
      id: "compliance", title: "Compliance queue", path: "compliance",
      blocks: [{
        type: "review-queue",
        title: "Escalated alerts",
        config: {
          source: "aml_alerts",
          openWhere: [{ field: "status", op: "eq", value: "escalated" }],
          claimAction: "takeEscalation",
          decisionActions: ["fileSar", "closeNoSar"],
          summaryFields: ["rule", { field: "amount", format: "currency" }, { field: "risk_score", label: "Risk" }],
          detailFields: ["customer_name", "customer_email", "account_number", { field: "amount", format: "currency" }, "rule", "risk_score", "alert_date", "assignee"],
          sla: { field: "alert_date", hours: 720 },
          badges: [
            { when: [{ field: "risk_score", op: "gte", value: 80 }], label: "High risk", tone: "bad" },
            { when: OVER_10K, label: "Over $10k", tone: "warn" },
          ],
        },
      }],
    },
    {
      id: "all", title: "All alerts", path: "alerts",
      blocks: [{
        type: "data-grid",
        config: {
          source: "aml_alerts",
          columns: ["id", "customer_name", { field: "amount", format: "currency" }, "rule", "risk_score", "status", "assignee", "sar_reference", { field: "alert_date", format: "relative" }],
          filters: [
            { field: "status", options: ["new", "in_review", "escalated", "sar_filed", "closed_false_positive"] },
            { field: "rule", options: ["structuring_cash", "rapid_movement", "high_risk_geo", "velocity_spike", "round_amount_wires"] },
          ],
          rowLink: "alerts/:id",
          exportable: true,
          pageSize: 50,
        },
      }],
    },
    {
      id: "alert", title: "Alert", path: "alerts/:id", nav: false,
      blocks: [
        {
          type: "record-detail", width: "two-thirds",
          config: {
            source: "aml_alerts",
            fields: ["customer_name", "customer_email", "account_number", { field: "amount", format: "currency" }, "rule", "risk_score", "status", "assignee", "alert_date", "sar_reference"],
            actions: ["claim", "closeFalsePositive", "escalate", "takeEscalation", "fileSar", "closeNoSar"],
            backLink: "alerts",
          },
        },
        { type: "audit-timeline", width: "third", title: "Alert history", config: { scope: "record", source: "aml_alerts" } },
        { type: "comments", config: { source: "aml_alerts" } },
      ],
    },
    { id: "activity", title: "Activity", path: "activity", blocks: [{ type: "audit-timeline", config: { scope: "app", limit: 100 } }] },
  ],
});
