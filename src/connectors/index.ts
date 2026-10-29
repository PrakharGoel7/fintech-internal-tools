import { TableSource, type SourceDef } from "./table-source";
export { externalConnectors } from "./external";
export type { SourceDef, ListOptions } from "./table-source";
export { TableSource };

const defs: SourceDef[] = [
  {
    name: "kyc_cases",
    table: "kyc_cases",
    label: "KYC case",
    pk: "id",
    titleField: "customer_name",
    piiFields: ["email", "ssn_last4", "dob"],
    searchFields: ["id", "customer_name", "country"],
    defaultSort: { field: "created_at", dir: "asc" },
    fields: {
      id: { label: "Case", type: "text" },
      customer_name: { label: "Customer", type: "text" },
      email: { label: "Email", type: "text" },
      ssn_last4: { label: "SSN (last 4)", type: "text" },
      dob: { label: "Date of birth", type: "text" },
      country: { label: "Country", type: "text" },
      doc_type: { label: "Document", type: "text" },
      risk_score: { label: "Risk score", type: "number" },
      vendor_result: { label: "Vendor result", type: "status" },
      status: { label: "Status", type: "status" },
      assignee: { label: "Assignee", type: "text" },
      created_at: { label: "Submitted", type: "date" },
      updated_at: { label: "Updated", type: "date" },
    },
  },
  {
    name: "refunds",
    table: "refunds",
    label: "Refund",
    pk: "id",
    titleField: "id",
    piiFields: ["email"],
    searchFields: ["id", "charge_id", "customer_name", "reason"],
    defaultSort: { field: "created_at", dir: "desc" },
    fields: {
      id: { label: "Refund", type: "text" },
      charge_id: { label: "Charge", type: "text" },
      customer_name: { label: "Customer", type: "text" },
      email: { label: "Email", type: "text" },
      amount: { label: "Amount", type: "currency" },
      currency: { label: "Currency", type: "text" },
      reason: { label: "Reason", type: "text" },
      status: { label: "Status", type: "status" },
      stripe_refund_id: { label: "Stripe refund", type: "text" },
      requested_by: { label: "Requested by", type: "text" },
      created_at: { label: "Requested", type: "date" },
      updated_at: { label: "Updated", type: "date" },
    },
  },
  {
    name: "feature_flags",
    table: "feature_flags",
    label: "Feature flag",
    pk: "id",
    titleField: "id",
    piiFields: [],
    searchFields: ["id", "description", "owner"],
    defaultSort: { field: "id", dir: "asc" },
    fields: {
      id: { label: "Flag", type: "text" },
      description: { label: "Description", type: "text" },
      owner: { label: "Owner", type: "text" },
      enabled_dev: { label: "Dev", type: "boolean" },
      enabled_staging: { label: "Staging", type: "boolean" },
      enabled_prod: { label: "Prod", type: "boolean" },
      rollout_pct: { label: "Rollout %", type: "number" },
      created_at: { label: "Created", type: "date" },
      updated_at: { label: "Updated", type: "date" },
    },
  },
];

export const sources: Record<string, TableSource> = Object.fromEntries(defs.map((d) => [d.name, new TableSource(d)]));

export function getSource(name: string): TableSource {
  const s = sources[name];
  if (!s) throw new Error(`Unknown data source "${name}"`);
  return s;
}
