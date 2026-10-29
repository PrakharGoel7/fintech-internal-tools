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
| Ratio metrics (win rate = won / (won + lost)) — `chart` / `metric-cards` only aggregate count/sum/avg | chargeback-disputes (1) | derived `win_pct` column (100 = won, 0 = lost, null otherwise) seeded only — no sync or action sets it yet; `chart` uses `agg: avg` | app-local |
| Time-relative conditions (e.g. "evidence due within 48h") in `metric-cards` / `where` | chargeback-disputes (1) | not built — per-item deadline badges in the queue instead | open |
| Only the current assignee may close/escalate a claimed item — conditions can't reference the acting user (`$user`), and a handler check would run as the approver after maker-checker | aml-alerts (1) | not built in v1 (requester-confirmed); any analyst/compliance user can act on an in-review alert | open — candidate platform extension (`$user` in `availableWhen`) |
| Hide some records/fields from a role (e.g. SAR outcomes from analysts) — no role-based row/field visibility | aml-alerts (1) | not built in v1 (requester-confirmed: analysts may see outcomes) | open — compliance-critical if requested again → platform/block candidate |
| Ingest records from an upstream system feed (transaction-monitoring alerts) | aml-alerts (1) | synthetic seed only in v1 | open — future connector |
