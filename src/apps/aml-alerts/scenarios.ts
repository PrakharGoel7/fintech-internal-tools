import { defineScenarios } from "@/platform";

const alert = (status: string, amount = 2500, assignee: string | null = "tom") => ({ status, amount, assignee, risk_score: 55 });

export default defineScenarios("aml-alerts", [
  // Access
  { says: "AML analysts can open the alert review app", as: "tom", open: true, expect: "allowed" },
  { says: "Compliance officers can open the alert review app", as: "carol", open: true, expect: "allowed" },
  { says: "Support agents cannot open the alert review app", as: "sam", open: true, expect: "denied" },
  { says: "KYC ops analysts cannot open the alert review app", as: "alice", open: true, expect: "denied" },

  // Claiming
  { says: "An analyst can claim a new alert; it becomes In review and is assigned to them", as: "tom", do: "claim", given: alert("new", 2500, null), expect: "allowed", then: { status: "in_review", assignee: "tom" } },
  { says: "An alert someone is already reviewing cannot be claimed by another analyst", as: "tom", do: "claim", given: alert("in_review", 2500, "carol"), expect: "blocked", because: "not available" },
  { says: "KYC ops analysts cannot claim AML alerts", as: "alice", do: "claim", given: alert("new", 2500, null), expect: "denied" },

  // Closing as false positive
  { says: "An analyst can close a $10,000.00 alert as a false positive straight away", as: "tom", do: "closeFalsePositive", given: alert("in_review", 10000), expect: "allowed", then: { status: "closed_false_positive" } },
  { says: "Closing a $10,000.01 alert as a false positive waits for a compliance officer; Carol approves it and it is closed", as: "tom", do: "closeFalsePositive", given: alert("in_review", 10000.01), expect: "needs-approval", approvers: ["compliance"], approvedBy: "carol", then: { status: "closed_false_positive" } },
  { says: "If the compliance officer rejects it, the alert stays In review", as: "tom", do: "closeFalsePositive", given: alert("in_review", 25000), expect: "needs-approval", rejectedBy: "carol" },
  { says: "Closing as a false positive needs a reason code", as: "tom", do: "closeFalsePositive", given: alert("in_review"), reason: "", expect: "blocked", because: "reason code" },
  { says: "Closing as a false positive needs a written note", as: "tom", do: "closeFalsePositive", given: alert("in_review"), note: "", expect: "blocked", because: "note" },
  { says: "An alert that is already closed cannot be closed again", as: "tom", do: "closeFalsePositive", given: alert("closed_false_positive"), expect: "blocked", because: "not available" },
  { says: "An alert that is already closed cannot be escalated", as: "tom", do: "escalate", given: alert("closed_false_positive"), expect: "blocked", because: "not available" },

  // Escalation & SAR
  { says: "An analyst can escalate an alert they're reviewing; it goes to the compliance queue, unassigned", as: "tom", do: "escalate", given: alert("in_review"), expect: "allowed", then: { status: "escalated", assignee: null } },
  { says: "Escalating needs a note", as: "tom", do: "escalate", given: alert("in_review"), note: "", expect: "blocked", because: "note" },
  { says: "A compliance officer can take an escalated alert; it is assigned to them", as: "carol", do: "takeEscalation", given: alert("escalated", 2500, null), expect: "allowed", then: { status: "escalated", assignee: "carol" } },
  { says: "Analysts cannot file a SAR", as: "tom", do: "fileSar", given: alert("escalated"), expect: "denied" },
  { says: "When Carol files a SAR it waits for a second compliance officer; Grace approves it and the alert is marked SAR filed with a SAR reference", as: "carol", do: "fileSar", given: alert("escalated", 2500, "carol"), expect: "needs-approval", approvers: ["compliance"], approvedBy: "grace", then: { status: "sar_filed" } },
  { says: "Even a $1 SAR filing waits for a second compliance officer", as: "grace", do: "fileSar", given: alert("escalated", 1, "grace"), expect: "needs-approval", approvers: ["compliance"], approvedBy: "carol", then: { status: "sar_filed" } },
  { says: "If the second compliance officer rejects a SAR filing, the alert stays Escalated", as: "carol", do: "fileSar", given: alert("escalated", 2500, "carol"), expect: "needs-approval", rejectedBy: "grace" },
  { says: "A SAR can only be filed on an escalated alert, not straight from triage", as: "carol", do: "fileSar", given: alert("in_review", 2500, "carol"), expect: "blocked", because: "not available" },
  { says: "Filing a SAR needs a reason code", as: "carol", do: "fileSar", given: alert("escalated", 2500, "carol"), reason: "", expect: "blocked", because: "reason code" },
  { says: "Filing a SAR needs a narrative note", as: "carol", do: "fileSar", given: alert("escalated", 2500, "carol"), note: "", expect: "blocked", because: "note" },
  { says: "A SAR cannot be filed twice", as: "carol", do: "fileSar", given: alert("sar_filed", 2500, "carol"), expect: "blocked", because: "not available" },
  { says: "A compliance officer can close an escalated $10,000.00 alert without a SAR straight away", as: "carol", do: "closeNoSar", given: alert("escalated", 10000, "carol"), expect: "allowed", then: { status: "closed_false_positive" } },
  { says: "Closing an escalated $10,000.01 alert without a SAR waits for another compliance officer", as: "carol", do: "closeNoSar", given: alert("escalated", 10000.01, "carol"), expect: "needs-approval", approvers: ["compliance"], approvedBy: "grace", then: { status: "closed_false_positive" } },
  { says: "Closing an escalated alert without a SAR needs a reason code and a written note", as: "carol", do: "closeNoSar", given: alert("escalated", 2500, "carol"), note: "", expect: "blocked", because: "note" },
  { says: "Analysts cannot close an escalated alert themselves", as: "tom", do: "closeNoSar", given: alert("escalated"), expect: "denied" },

  // Sensitive data
  { says: "Customer name, email and account number are masked by default", as: "tom", source: "aml_alerts", masked: ["customer_name", "customer_email", "account_number"] },
  { says: "Analysts cannot reveal the account number", as: "tom", source: "aml_alerts", reveal: "account_number", expect: "denied" },
  { says: "Analysts cannot reveal the customer name", as: "tom", source: "aml_alerts", reveal: "customer_name", expect: "denied" },
  { says: "Analysts cannot reveal the customer email", as: "tom", source: "aml_alerts", reveal: "customer_email", expect: "denied" },
  { says: "Compliance officers can reveal the account number (logged)", as: "carol", source: "aml_alerts", reveal: "account_number", expect: "allowed" },
  { says: "Compliance officers can reveal the customer name (logged)", as: "carol", source: "aml_alerts", reveal: "customer_name", expect: "allowed" },
  { says: "Compliance officers can reveal the customer email (logged)", as: "grace", source: "aml_alerts", reveal: "customer_email", expect: "allowed" },
]);
