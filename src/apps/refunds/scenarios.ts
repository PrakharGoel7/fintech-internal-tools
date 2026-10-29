import { defineScenarios } from "@/platform";

const requested = (amount: number) => ({ status: "requested", amount, currency: "USD" });

export default defineScenarios("refunds", [
  { says: "Support agents can open the refunds dashboard", as: "sam", open: true, expect: "allowed" },
  { says: "Engineers cannot open the refunds dashboard", as: "dan", open: true, expect: "denied" },
  { says: "Support agents can request a refund; it starts as Requested", as: "sam", do: "requestRefund", given: { charge_id: "ch_test", customer_name: "Test Customer", email: "t@example.test", amount: 40, reason: "duplicate" }, expect: "allowed", then: { status: "requested", requested_by: "sam" } },
  { says: "Support agents cannot issue refunds", as: "sam", do: "issueRefund", given: requested(40), expect: "denied" },
  { says: "A refund of exactly $500 is issued immediately", as: "bob", do: "issueRefund", given: requested(500), expect: "allowed", then: { status: "issued" } },
  { says: "A refund of $500.01 waits for Finance Lead approval, then is issued", as: "bob", do: "issueRefund", given: requested(500.01), expect: "needs-approval", approvers: ["finance-lead"], approvedBy: "erin", then: { status: "issued" } },
  { says: "If Finance rejects a large refund, it stays Requested", as: "bob", do: "issueRefund", given: requested(900), expect: "needs-approval", rejectedBy: "erin" },
  { says: "Issuing a refund needs a reason code", as: "bob", do: "issueRefund", given: requested(40), reason: "", expect: "blocked", because: "reason code" },
  { says: "An already-denied refund cannot be issued", as: "bob", do: "issueRefund", given: { ...requested(40), status: "denied" }, expect: "blocked", because: "not available" },
  { says: "Customer email is masked by default", as: "sam", source: "refunds", masked: ["email"] },
  { says: "Support agents cannot reveal customer email", as: "sam", source: "refunds", reveal: "email", expect: "denied" },
  { says: "Finance leads can reveal customer email (logged)", as: "erin", source: "refunds", reveal: "email", expect: "allowed" },
]);
