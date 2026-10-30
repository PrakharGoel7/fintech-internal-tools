import { defineScenarios } from "@/platform";

const inReview = (risk: number) => ({ status: "in_review", assignee: "alice", risk_score: risk });

export default defineScenarios("kyc-review", [
  { says: "KYC analysts can open the queue", as: "alice", open: true, expect: "allowed" },
  { says: "Support agents cannot open the queue", as: "sam", open: true, expect: "denied" },
  { says: "An analyst can claim a pending case and it moves to In review", as: "alice", do: "claim", given: { status: "pending" }, expect: "allowed", then: { status: "in_review", assignee: "alice" } },
  { says: "Support agents cannot claim cases", as: "sam", do: "claim", given: { status: "pending" }, expect: "denied" },
  { says: "A case with risk score exactly 70 can be approved by an analyst alone", as: "alice", do: "approve", given: inReview(70), expect: "allowed", then: { status: "approved" } },
  { says: "A case with risk score 71 waits for Compliance; Compliance approves it", as: "alice", do: "approve", given: inReview(71), expect: "needs-approval", approvers: ["compliance"], approvedBy: "carol", then: { status: "approved" } },
  { says: "If Compliance rejects a high-risk approval, the case stays In review", as: "alice", do: "approve", given: inReview(85), expect: "needs-approval", rejectedBy: "carol" },
  { says: "Approving needs a reason code", as: "alice", do: "approve", given: inReview(20), reason: "", expect: "blocked", because: "reason code" },
  { says: "A case must be claimed before it can be approved", as: "alice", do: "approve", given: { status: "pending", risk_score: 20 }, expect: "blocked", because: "not available" },
  { says: "Escalating needs a note", as: "alice", do: "escalate", given: inReview(50), note: "", expect: "blocked", because: "note" },
  { says: "Email, SSN and date of birth are masked by default", as: "alice", source: "kyc_cases", masked: ["email", "ssn_last4", "dob"] },
  { says: "Analysts cannot reveal the SSN", as: "alice", source: "kyc_cases", reveal: "ssn_last4", expect: "denied" },
  { says: "Ops leads can reveal the SSN (logged)", as: "bob", source: "kyc_cases", reveal: "ssn_last4", expect: "allowed" },
  {
    says: "A low-risk case is claimed and approved by the analyst",
    given: { status: "pending", risk_score: 30 },
    steps: [
      { says: "Alice claims the case", as: "alice", do: "claim", then: { status: "in_review", assignee: "alice" } },
      { says: "Alice approves it: documents verified", as: "alice", do: "approve", reason: "documents_verified", then: { status: "approved" } },
    ],
  },
  {
    says: "A high-risk approval goes to Compliance, and Carol signs it off",
    given: { status: "pending", risk_score: 85 },
    steps: [
      { says: "Alice claims the case", as: "alice", do: "claim", then: { status: "in_review" } },
      { says: "Alice approves it; it waits for Compliance", as: "alice", do: "approve", expect: "waits", then: { status: "in_review" } },
      { says: "Carol approves in Approvals and the case is approved", as: "carol", approve: true, then: { status: "approved" } },
    ],
  },
  {
    says: "Compliance rejects a high-risk approval, so the analyst escalates the case instead",
    given: { status: "pending", risk_score: 85 },
    steps: [
      { says: "Alice claims the case", as: "alice", do: "claim" },
      { says: "Alice approves it; it waits for Compliance", as: "alice", do: "approve", expect: "waits" },
      { says: "Carol rejects the approval; the case stays In review", as: "carol", reject: true, then: { status: "in_review" } },
      { says: "Alice escalates it with a note; it goes to Carol", as: "alice", do: "escalate", then: { status: "escalated", assignee: "carol" } },
    ],
  },
  {
    says: "A case with mismatched documents is rejected",
    given: { status: "pending", risk_score: 40 },
    steps: [
      { says: "Alice claims the case", as: "alice", do: "claim" },
      { says: "Alice rejects it: document mismatch", as: "alice", do: "reject", reason: "document_mismatch", then: { status: "rejected" } },
    ],
  },
]);
