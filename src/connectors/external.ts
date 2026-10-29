import crypto from "node:crypto";
import type { Row } from "@/platform/db";

/**
 * Mocked third-party connectors. Each op receives the raw record + user input and
 * returns a patch for the record. Swap the body for the real SDK call in production.
 */
export type ConnectorOp = (record: Row | null, input: Row) => Row | Promise<Row>;

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
};
