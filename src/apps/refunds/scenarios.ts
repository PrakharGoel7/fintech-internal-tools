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
  {
    says: "Support requests a small refund and an ops lead issues it",
    steps: [
      { says: "Sam requests a $40 refund", as: "sam", do: "requestRefund", input: { charge_id: "ch_journey_small_$unique", customer_name: "Journey Customer", email: "j@example.test", amount: 40, reason: "duplicate_charge" }, then: { status: "requested", requested_by: "sam" } },
      { says: "Bob issues it", as: "bob", do: "issueRefund", reason: "verified_duplicate", then: { status: "issued" } },
    ],
  },
  {
    says: "A large refund waits for Finance and is issued once Erin approves",
    steps: [
      { says: "Sam requests a $900 refund", as: "sam", do: "requestRefund", input: { charge_id: "ch_journey_large_$unique", customer_name: "Journey Customer", email: "j@example.test", amount: 900, reason: "service_outage" }, then: { status: "requested" } },
      { says: "Bob issues it; it waits for a Finance Lead", as: "bob", do: "issueRefund", expect: "waits", then: { status: "requested" } },
      { says: "Erin approves in Approvals and the refund is issued", as: "erin", approve: true, then: { status: "issued" } },
    ],
  },
  {
    says: "Finance rejects a large refund, so the ops lead denies it",
    steps: [
      { says: "Sam requests a $900 refund", as: "sam", do: "requestRefund", input: { charge_id: "ch_journey_denied_$unique", customer_name: "Journey Customer", email: "j@example.test", amount: 900, reason: "customer_request" } },
      { says: "Bob issues it; it waits for a Finance Lead", as: "bob", do: "issueRefund", expect: "waits" },
      { says: "Erin rejects it; the refund stays Requested", as: "erin", reject: true, then: { status: "requested" } },
      { says: "Bob denies the refund: outside policy", as: "bob", do: "denyRefund", reason: "outside_policy", then: { status: "denied" } },
      { says: "A denied refund can no longer be issued", as: "bob", do: "issueRefund", expect: "blocked" },
    ],
  },
]);
