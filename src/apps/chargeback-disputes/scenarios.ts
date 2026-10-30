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
  { says: "When Stripe rules for us, the analyst records the win and it counts toward the win rate", as: "alice", do: "recordWon", given: { ...open(200), status: "under_review" }, expect: "allowed", then: { status: "won", win_pct: 100 } },
  { says: "When Stripe rules against us, the analyst records the loss and it counts toward the win rate", as: "alice", do: "recordLost", given: { ...open(200), status: "under_review" }, expect: "allowed", then: { status: "lost", win_pct: 0 } },
  { says: "An outcome can't be recorded before evidence is submitted", as: "alice", do: "recordWon", given: open(200), expect: "blocked", because: "not available" },
  { says: "Finance leads cannot record outcomes", as: "erin", do: "recordWon", given: { ...open(200), status: "under_review" }, expect: "denied" },
  { says: "Customer name and email are masked by default", as: "alice", source: "disputes", masked: ["customer_name", "customer_email"] },
  { says: "Analysts cannot reveal customer email", as: "alice", source: "disputes", reveal: "customer_email", expect: "denied" },
  { says: "Ops leads can reveal customer email (logged)", as: "bob", source: "disputes", reveal: "customer_email", expect: "allowed" },
  {
    says: "An analyst claims a dispute and submits evidence before the deadline",
    given: open(300),
    steps: [
      { says: "Alice claims the dispute", as: "alice", do: "claim", then: { assignee: "alice", status: "needs_response" } },
      { says: "Alice submits proof of delivery", as: "alice", do: "contest", reason: "proof_of_delivery", then: { status: "under_review" } },
      { says: "Stripe rules in our favour, so Alice records the win", as: "alice", do: "recordWon", then: { status: "won", win_pct: 100 } },
    ],
  },
  {
    says: "A large write-off waits for Finance, and Erin approves it",
    given: open(2500),
    steps: [
      { says: "Alice claims the dispute", as: "alice", do: "claim" },
      { says: "Alice accepts the $2,500 dispute; it waits for a Finance Lead", as: "alice", do: "accept", expect: "waits", then: { status: "needs_response" } },
      { says: "Erin approves in Approvals and the dispute is accepted", as: "erin", approve: true, then: { status: "accepted" } },
    ],
  },
  {
    says: "Finance rejects a write-off, so the analyst contests the dispute instead",
    given: open(2500),
    steps: [
      { says: "Alice claims the dispute", as: "alice", do: "claim" },
      { says: "Alice accepts the dispute; it waits for a Finance Lead", as: "alice", do: "accept", expect: "waits" },
      { says: "Erin rejects the write-off; the dispute still needs a response", as: "erin", reject: true, then: { status: "needs_response" } },
      { says: "Alice submits evidence instead", as: "alice", do: "contest", then: { status: "under_review" } },
    ],
  },
]);
