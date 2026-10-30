# Gap ledger

Needs that no block covered when an app was built. Devin appends rows here instead of silently writing one-off code.
Rule: 1st app → app-local handler. 2nd app, or compliance-critical → shared module: an optional option on an existing block, or a new block (`create-block` skill).

| Gap | Apps (count) | Current implementation | Status |
|---|---|---|---|
| Route escalations to a specific reviewer based on record data | kyc-review (1) | `handlers.escalateToCompliance` | app-local |
| Percentage rollout editor (slider) for flags | feature-flags (1) | not built — `rollout_pct` shown read-only | open |
| Document/image viewer for uploaded IDs | kyc-review (1) | not built — vendor result only | open |
| Bulk actions on grid selections | refunds (1) | not built — row actions only | open |
| Countdown to an absolute external deadline (Stripe `evidence_due_by`); `review-queue.sla` only supported start + N hours | chargeback-disputes (1) | extended `review-queue` 1.1.0 with optional `sla.mode: "deadline"` (backwards compatible; default `elapsed`) | resolved (extend block) |
| Block an action when the actor is the record's creator (segregation of duties: entering clerk can't approve) | vendor-invoices (1) | platform action option `notBy: ["entered_by"]`, checked against whoever executes the action (the checker when approval applies) | resolved (shared; compliance-critical) |
| Date input on `form` (date picker / validation) | vendor-invoices (1) | text field with `YYYY-MM-DD` placeholder | open |
| Validation on create actions (unique vendor + invoice number, amount > 0) | vendor-invoices (1) | not built — create effects have no validation hook | open |
