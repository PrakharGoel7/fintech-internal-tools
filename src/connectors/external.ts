import crypto from "node:crypto";
import type { Row } from "@/platform/db";

/**
 * Mocked third-party connectors. Each op receives the raw record + user input and
 * returns a patch for the record. Swap the body for the real SDK call in production.
 */
export type ConnectorOp = (record: Row | null, input: Row) => Row | Promise<Row>;

const MAX_OVERRIDE_DAYS = 30;
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export const externalConnectors: Record<string, Record<string, ConnectorOp>> = {
  stripe: {
    /** stripe.refunds.create({ charge, amount }) – idempotent on charge id in the real SDK. */
    refund: (record) => {
      if (!record) throw new Error("stripe.refund requires a record");
      return { status: "issued", stripe_refund_id: id("re") };
    },
    /** stripe.disputes.update(id, { evidence, submit: true }) – Stripe rejects evidence after `evidence_due_by`. */
    submitDisputeEvidence: (record) => {
      if (!record) throw new Error("stripe.submitDisputeEvidence requires a record");
      if (new Date(String(record.evidence_due_by)).getTime() < Date.now()) throw new Error("Evidence deadline has passed; Stripe no longer accepts evidence");
      return { status: "under_review", evidence_submission_id: id("evs") };
    },
    /** stripe.disputes.close(id) – accepts the dispute; the disputed amount is forfeited (written off). */
    acceptDispute: (record) => {
      if (!record) throw new Error("stripe.acceptDispute requires a record");
      return { status: "accepted" };
    },
  },
  kycVendor: {
    /** Re-run watchlist / document screening with the KYC vendor (Persona/Alloy-style). */
    rescreen: (record) => {
      if (!record) throw new Error("kycVendor.rescreen requires a record");
      const score = Math.max(1, Math.min(99, Number(record.risk_score) + Math.round(Math.random() * 20 - 10)));
      return { risk_score: score, vendor_result: score > 70 ? "watchlist_hit" : score > 40 ? "needs_review" : "clear" };
    },
  },
  coreBanking: {
    /** core.accounts.setTransferLimitOverride(id, { limit, expiresOn }) – the core ledger enforces the limit and drops it at expiry. */
    applyLimitOverride: (record, input) => {
      if (!record) throw new Error("coreBanking.applyLimitOverride requires a record");
      const limit = Number(input.override_limit);
      if (!(limit > Number(record.daily_limit))) throw new Error("Override limit must exceed the current daily limit");
      const expiry = String(input.override_expiry ?? "");
      const days = (Date.parse(expiry) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000;
      if (!(days >= 1 && days <= MAX_OVERRIDE_DAYS)) throw new Error(`Override expiry must be between tomorrow and ${MAX_OVERRIDE_DAYS} days from today`);
      return { override_status: "active", override_limit: limit, override_expiry: expiry };
    },
    /** core.accounts.clearTransferLimitOverride(id) – back to the standard daily limit immediately. */
    revokeLimitOverride: (record) => {
      if (!record) throw new Error("coreBanking.revokeLimitOverride requires a record");
      return { override_status: "none", override_limit: null, override_expiry: null };
    },
  },
};
