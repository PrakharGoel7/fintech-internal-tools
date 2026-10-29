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
| Time-relative conditions (e.g. "evidence due within 48h", "override past its expiry") in `metric-cards` / `where`, and time-driven status transitions | chargeback-disputes, limit-overrides (2) | chargeback: per-item deadline badges. limit-overrides: no scheduler — manual `expireOverride` ("Mark expired") action; the core-banking connector enforces expiry itself | **propose extraction** — relative-date token in conditions is in progress in a parallel session; scheduled transitions still open |
| Collect typed values (amount, date) in the action dialog for an existing record — `form` only creates records, row actions only took reason + note | limit-overrides (1) | extended platform: optional `inputs: [{ field, label, type, required }]` on actions, rendered by the shared action dialog, validated/coerced by `runAction` (undeclared fields dropped) | resolved (extend platform) |
| Tiered approvers by amount (> $25k → Compliance, otherwise Ops Lead or Compliance) — `approval` allowed a single rule | limit-overrides (1) | extended platform: `approval` may be a list of rules, first match wins; a single rule object works unchanged | resolved (extend platform) |
| Record status should reflect a pending / rejected approval | limit-overrides (1) | extended platform: optional `pendingStatus` / `rejectedStatus` (+ `statusField`, default `status`) on actions; approval re-checks that the record is still pending | resolved (extend platform) |
| Validate action input against the record before routing to approval (new limit > current limit, expiry ≤ 30 days) | limit-overrides (1) | enforced in `coreBanking.applyLimitOverride`, i.e. when the approver approves; an invalid request fails on approve and is then rejected | app-local (connector) |
