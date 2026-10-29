# Gap ledger

Needs that no block covered when an app was built. Devin appends rows here instead of silently writing one-off code.
Rule: 1st occurrence → app-local handler. 2nd → propose extraction. 3rd or compliance-critical → new block (`create-block` skill).

| Gap | Apps (count) | Current implementation | Status |
|---|---|---|---|
| Route escalations to a specific reviewer based on record data | kyc-review (1) | `handlers.escalateToCompliance` | app-local |
| Percentage rollout editor (slider) for flags | feature-flags (1) | not built — `rollout_pct` shown read-only | open |
| Document/image viewer for uploaded IDs | kyc-review (1) | not built — vendor result only | open |
| Bulk actions on grid selections | refunds (1) | not built — row actions only | open |
| Countdown to an absolute external deadline (Stripe `evidence_due_by`); `review-queue.sla` only supported start + N hours | chargeback-disputes (1) | extended `review-queue` 1.1.0 with optional `sla.mode: "deadline"` (backwards compatible; default `elapsed`) | resolved (extend block) |
| Ratio metrics (win rate = won / (won + lost), matched rate, approval rate) — `chart` / `metric-cards` only aggregated count/sum/avg | chargeback-disputes, payout-reconciliation, merchant-onboarding (3) | extended `metric-cards` 1.1.0 and `chart` 1.1.0 with `agg: "ratio"` + `numerator` conditions (% of rows after `where`); chargeback-disputes switched off its seeded `win_pct` column | resolved (extend block) |
| Time-relative conditions (e.g. "evidence due within 48h", "last 30 days") in `metric-cards` / `where` | chargeback-disputes, payout-reconciliation (2) | platform conditions accept `"$now"`, `"$now-30d"`, `"$now+48h"` on gt/gte/lt/lte (field compared as a timestamp); used by payout-reconciliation, not yet adopted in chargeback-disputes | resolved (platform) |
| Conditions on an absolute value (threshold on \|difference\| so over- and under-payments both count) | payout-reconciliation (1) | derived `difference_abs` column written at ingestion (seed) | app-local |
| Persist the chosen reason code on the record / approval rule conditioned on the reason code | payout-reconciliation (1) | one action per resolution (`resolveTiming`, `resolveBankFee`, `resolveFx`) with a fixed `resolution` value; the approval rule sits on the fee/FX actions | app-local (config) |
| Daily ingestion + auto-matching of Stripe payouts against the bank feed | payout-reconciliation (1) | not built — synthetic seed rows only | open |
