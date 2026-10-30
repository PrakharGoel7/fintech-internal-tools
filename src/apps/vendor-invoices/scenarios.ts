import { defineScenarios } from "@/platform";

const invoice = { vendor_name: "Northwind Office Supply", invoice_number: "INV-1001", amount: 4800, due_date: "$now+14d", bank_account: "021000021-000123456789" };
const pending = (amount: number, enteredBy = "maya") => ({ ...invoice, amount, status: "pending_review", currency: "USD", entered_by: enteredBy });
const held = { ...pending(4800), status: "on_hold" };
const newInvoice = (amount: number, tag: string) => ({ ...invoice, amount, invoice_number: `INV-J-${tag}-$unique`, due_date: "2026-12-15" });

export default defineScenarios("vendor-invoices", [
  { says: "AP clerks can open the invoice queue", as: "maya", open: true, expect: "allowed" },
  { says: "Finance leads can open the invoice queue", as: "erin", open: true, expect: "allowed" },
  { says: "Support agents cannot open the invoice queue", as: "sam", open: true, expect: "denied" },

  { says: "An AP clerk enters a vendor invoice; it starts as Pending review and records who entered it", as: "maya", do: "enterInvoice", given: invoice, expect: "allowed", then: { status: "pending_review", entered_by: "maya", currency: "USD" } },
  { says: "Support agents cannot enter invoices", as: "sam", do: "enterInvoice", given: invoice, expect: "denied" },
  { says: "Finance leads cannot enter invoices (they only approve big ones)", as: "erin", do: "enterInvoice", given: invoice, expect: "denied" },

  { says: "A clerk approves an invoice of exactly $25,000.00 for payment without Finance Lead approval", as: "leo", do: "approve", given: pending(25000), expect: "allowed", then: { status: "approved", approved_by: "leo" } },
  { says: "An invoice of $25,000.01 waits for Finance Lead approval; Erin approves it and it is approved for payment", as: "leo", do: "approve", given: pending(25000.01), expect: "needs-approval", approvers: ["finance-lead"], approvedBy: "erin", then: { status: "approved", approved_by: "erin" } },
  { says: "If a Finance Lead rejects the approval of a big invoice, it stays Pending review", as: "leo", do: "approve", given: pending(40000), expect: "needs-approval", rejectedBy: "erin" },
  { says: "A clerk cannot approve for payment an invoice they entered themselves", as: "maya", do: "approve", given: pending(4800, "maya"), expect: "blocked", because: "entered" },
  { says: "Finance leads cannot approve invoices for payment directly; they only sign off big ones in Approvals", as: "erin", do: "approve", given: pending(4800), expect: "denied" },
  { says: "Approving for payment needs a reason code", as: "leo", do: "approve", given: pending(4800), reason: "", expect: "blocked", because: "reason code" },
  { says: "A held invoice cannot be approved for payment until it is released", as: "leo", do: "approve", given: held, expect: "blocked", because: "not available" },
  { says: "A rejected invoice cannot be approved for payment", as: "leo", do: "approve", given: { ...pending(4800), status: "rejected" }, expect: "blocked", because: "not available" },

  { says: "A clerk rejects an invoice with a reason; it becomes Rejected", as: "leo", do: "reject", given: pending(4800), expect: "allowed", then: { status: "rejected" } },
  { says: "Support agents cannot reject invoices", as: "sam", do: "reject", given: pending(4800), expect: "denied" },
  { says: "Rejecting needs a reason code", as: "leo", do: "reject", given: pending(4800), reason: "", expect: "blocked", because: "reason code" },
  { says: "Rejecting needs a note explaining the reason", as: "leo", do: "reject", given: pending(4800), note: "", expect: "blocked", because: "note" },
  { says: "An invoice already approved for payment cannot be rejected", as: "leo", do: "reject", given: { ...pending(4800), status: "approved" }, expect: "blocked", because: "not available" },

  { says: "A clerk puts an invoice on hold; it becomes On hold", as: "leo", do: "hold", given: pending(4800), expect: "allowed", then: { status: "on_hold" } },
  { says: "Finance leads cannot put invoices on hold", as: "erin", do: "hold", given: pending(4800), expect: "denied" },
  { says: "Putting an invoice on hold needs a note", as: "leo", do: "hold", given: pending(4800), note: "", expect: "blocked", because: "note" },
  { says: "An invoice already approved for payment cannot be put on hold", as: "leo", do: "hold", given: { ...pending(4800), status: "approved" }, expect: "blocked", because: "not available" },

  { says: "A clerk releases a held invoice; it goes back to Pending review", as: "leo", do: "release", given: held, expect: "allowed", then: { status: "pending_review" } },
  { says: "Support agents cannot release held invoices", as: "sam", do: "release", given: held, expect: "denied" },
  { says: "Releasing needs a reason code", as: "leo", do: "release", given: held, reason: "", expect: "blocked", because: "reason code" },
  { says: "Only held invoices can be released", as: "leo", do: "release", given: pending(4800), expect: "blocked", because: "not available" },

  { says: "The vendor bank account is masked by default", as: "maya", source: "vendor_invoices", masked: ["bank_account"] },
  { says: "AP clerks cannot reveal the vendor bank account", as: "maya", source: "vendor_invoices", reveal: "bank_account", expect: "denied" },
  { says: "Finance leads can reveal the vendor bank account (logged)", as: "erin", source: "vendor_invoices", reveal: "bank_account", expect: "allowed" },

  {
    says: "A normal invoice is entered by one clerk and approved for payment by another",
    steps: [
      { says: "Maya enters a $4,800 invoice from Northwind", as: "maya", do: "enterInvoice", input: newInvoice(4800, "small"), then: { status: "pending_review", entered_by: "maya" } },
      { says: "Leo reviews it and approves it for payment: matches the purchase order", as: "leo", do: "approve", reason: "matches_po", then: { status: "approved", approved_by: "leo" } },
    ],
  },
  {
    says: "A $40,000 invoice waits for a Finance Lead, and Erin approves it for payment",
    steps: [
      { says: "Maya enters a $40,000 invoice", as: "maya", do: "enterInvoice", input: newInvoice(40000, "large"), then: { status: "pending_review" } },
      { says: "Leo approves it for payment; it waits for a Finance Lead", as: "leo", do: "approve", expect: "waits", then: { status: "pending_review" } },
      { says: "Erin approves in Approvals and the invoice is approved for payment", as: "erin", approve: true, then: { status: "approved", approved_by: "erin" } },
    ],
  },
  {
    says: "A Finance Lead turns down a $40,000 invoice, so the clerk rejects it with a reason",
    steps: [
      { says: "Maya enters a $40,000 invoice", as: "maya", do: "enterInvoice", input: newInvoice(40000, "rejected") },
      { says: "Leo approves it for payment; it waits for a Finance Lead", as: "leo", do: "approve", expect: "waits" },
      { says: "Erin rejects the approval; the invoice stays Pending review", as: "erin", reject: true, then: { status: "pending_review" } },
      { says: "Leo rejects the invoice: amount does not match the purchase order", as: "leo", do: "reject", reason: "amount_mismatch", then: { status: "rejected" } },
      { says: "A rejected invoice can no longer be approved for payment", as: "leo", do: "approve", expect: "blocked" },
    ],
  },
  {
    says: "An invoice is put on hold while the vendor confirms details, then released and approved for payment",
    steps: [
      { says: "Maya enters a $12,000 invoice", as: "maya", do: "enterInvoice", input: newInvoice(12000, "held") },
      { says: "Leo puts it on hold: waiting for the purchase order", as: "leo", do: "hold", reason: "awaiting_po", then: { status: "on_hold" } },
      { says: "While it is on hold it cannot be approved for payment", as: "leo", do: "approve", expect: "blocked" },
      { says: "Leo releases it once the purchase order arrives; it is back to Pending review", as: "leo", do: "release", reason: "info_received", then: { status: "pending_review" } },
      { says: "Leo approves it for payment", as: "leo", do: "approve", reason: "matches_po", then: { status: "approved", approved_by: "leo" } },
    ],
  },
]);
