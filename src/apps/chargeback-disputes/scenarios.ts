import { defineScenarios } from "@/platform";

const open = (amount: number, due = "$now+3d") => ({ status: "needs_response", amount, currency: "USD", evidence_due_by: due });

export default defineScenarios("chargeback-disputes", [
  { says: "Finance leads can view disputes", as: "erin", open: true, expect: "allowed" },
  { says: "Support agents cannot open the dispute queue", as: "sam", open: true, expect: "denied" },
  { says: "Finance leads cannot submit evidence", as: "erin", do: "contest", given: open(200), expect: "denied" },
  { says: "An analyst can claim an open dispute", as: "alice", do: "claim", given: open(200), expect: "allowed", then: { assignee: "alice" } },
  { says: "Submitting evidence before the deadline moves the dispute to Under review", as: "alice", do: "contest", given: open(200), expect: "allowed", then: { status: "under_review" } },
  { says: "Evidence cannot be submitted after the deadline", as: "alice", do: "contest", given: open(200, "$now-1h"), expect: "blocked", because: "deadline" },
  { says: "Submitting evidence needs a note", as: "alice", do: "contest", given: open(200), note: "", expect: "blocked", because: "note" },
  { says: "Writing off exactly $1,000 needs no approval", as: "alice", do: "accept", given: open(1000), expect: "allowed", then: { status: "accepted" } },
  { says: "Writing off $1,000.01 waits for Finance Lead approval", as: "alice", do: "accept", given: open(1000.01), expect: "needs-approval", approvers: ["finance-lead"], approvedBy: "erin", then: { status: "accepted" } },
  { says: "Customer name and email are masked by default", as: "alice", source: "disputes", masked: ["customer_name", "customer_email"] },
  { says: "Analysts cannot reveal customer email", as: "alice", source: "disputes", reveal: "customer_email", expect: "denied" },
  { says: "Ops leads can reveal customer email (logged)", as: "bob", source: "disputes", reveal: "customer_email", expect: "allowed" },
]);
