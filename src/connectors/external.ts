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
