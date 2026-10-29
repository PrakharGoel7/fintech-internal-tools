---
name: build-internal-app
description: Turn an internal-tool request (from ops, compliance or engineering) into a new app composed from the block catalog. Use for any "build/add an internal app/dashboard/queue/admin panel" request.
---

# Build an internal app

## Phase 0 — Load context
1. Read `AGENTS.md`, `catalog.json` (blocks, config schemas, connectors, existing apps) and `GAPS.md`.
2. Skim one similar existing app in `src/apps/*/app.ts` as a style reference.

## Phase 1 — Spec + gap analysis (STOP for approval when the requester is available)
Write a short spec (post it in the PR description / session) containing:
- **Users & roles** → `permissions` map (reuse roles from `src/platform/users.ts`; add a role only if none fits).
- **Data** → existing source, or a new `SourceDef` in `src/connectors/index.ts` (the table is created from its `fields`, in column order; add synthetic seed rows in `scripts/seed.ts`; give domain status values badge `tones`). Tag every PII field.
- **Actions** → each with permission, effect, `availableWhen`, `reasonCodes`, `approval` rule.
- **Pages** → blocks and their config.
- **Requirement coverage table** — classify every requirement:
  | Requirement | Covered by | Class |
  |---|---|---|
  | … | `review-queue` config | covered |
  | … | new optional field on `data-grid` | extend block |
  | … | `handlers.foo` | app-local (log in GAPS.md) |
  | … | — | new block candidate |
- **Fintech checklist**: money movement / PII / prod config? → reason codes, maker-checker threshold, PII masking, export permission, who can reveal.

- **Scenarios to confirm** — the requester never writes test cases; you draft them from what they already wrote (who uses it, actions, approvals, sensitive data). Write each as one plain-language sentence a non-engineer can confirm, e.g. "A refund of $500.01 waits for Finance Lead approval". Always include:
  - each role that should use the app can open it, and one role that shouldn't can't;
  - each action done by an allowed role, and refused for a role without permission;
  - every threshold at the boundary: exactly at it, and just over it;
  - every approval: it waits, then a named checker approves it (the requester can never approve their own; the harness checks that automatically);
  - every PII field masked by default; one role that can reveal it and one that can't;
  - required reason codes / notes, and actions blocked in the wrong status or after a deadline.
- **Questions for the requester** — turn every ambiguity into a yes/no question ("Should a refund of exactly $500 need approval?"). Never guess silently.

Ask the requester to tick, untick or edit the scenarios and answer the questions. If the request is ambiguous about approvals or PII and they don't answer, choose the stricter option and call it out.

## Phase 2 — Build
1. Create `src/apps/<slug>/app.ts` using `defineApp` (import only from `@/platform`).
2. Register it in `src/apps/registry.ts`.
3. New data: add source + table + seed data. External systems: add a mocked op in `src/connectors/external.ts`.
4. App-local logic goes in `handlers`. Add a `GAPS.md` row for every handler / unmet need; if the same gap already has an entry, bump its count and propose extraction.
5. Encode the confirmed scenarios in `src/apps/<slug>/scenarios.ts` with `defineScenarios` (see `src/apps/refunds/scenarios.ts`). `tests/scenarios.test.ts` runs each one through the real platform; use the requester's sentence verbatim as `says`. Add Vitest tests only for logic scenarios can't express (e.g. handler internals).
6. Only create a new block (use the `create-block` skill) if a gap is hit for the 3rd time or is compliance-critical.

## Phase 3 — Verify
```
npm run seed && npm run catalog && npm run check && npm run build
npm start & npm run smoke   # every page of every app, as every role allowed to view it
```
A failing scenario means the app disagrees with what the requester confirmed: fix the app, or go back to the requester; never edit the scenario to make it pass. (Stop the server before re-running `npm run seed`; a running server keeps the old data.)
Then `npm run dev`, switch through the relevant users in the mock-SSO dropdown, and verify: role visibility, each action, an approval round-trip (maker ≠ checker), PII masked + reveal audited, audit log chain still verifies.

## Phase 4 — PR
Title `feat(app): <name>`. Description: the spec, the confirmed scenarios (`npm run scenarios -- <slug>` prints them as a checklist), the coverage table, rung used for each customization, GAPS.md changes, screenshots.
