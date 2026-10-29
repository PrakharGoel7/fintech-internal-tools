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
| Ratio metrics (win rate = won / (won + lost); approval rate = approved / (approved + rejected)) — `chart` / `metric-cards` only aggregate count/sum/avg | chargeback-disputes, merchant-onboarding, payout-reconciliation (3) | chargeback-disputes: derived `win_pct` column. merchant-onboarding: per-risk-tier approved-vs-rejected count pies (TODO in `app.ts`), no derived column | **3rd occurrence → block extension**: generic ratio option for `metric-cards` + `chart` in progress in the Payout Reconciliation session (https://app.devin.ai/sessions/748da1fd358741b6a04288efd2010d4c); migrate both apps when it lands |
| Time-relative conditions (e.g. "evidence due within 48h") in `metric-cards` / `where` | chargeback-disputes (1) | not built — per-item deadline badges in the queue instead | open |
