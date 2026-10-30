---
name: build-internal-app
description: Turn an internal-tool request (from ops, compliance or engineering) into a new app composed from the block catalog. Use for any "build/add an internal app/dashboard/queue/admin panel" request.
---

# Build an internal app

## Phase 0 — Load context
1. Read `AGENTS.md`, `catalog.json` (blocks, config schemas, connectors, existing apps) and `GAPS.md`.
2. Skim one similar existing app in `src/apps/*/app.ts` as a style reference.

## Phase 1 — Spec + tests, approved by an engineer (STOP until approved)
The requester is non-technical and is **never asked questions**: work only from what they wrote in the form. An engineer reviews and approves the spec before anything is built.

Write a short spec containing:
- **Users & roles** → `permissions` map (reuse roles from `src/platform/users.ts`; add a role only if none fits).
- **Data** → existing source, or a new `SourceDef` in `src/connectors/index.ts` (the table is created from its `fields`, in column order; add synthetic seed rows in `scripts/seed.ts`; give domain status values badge `tones`). Tag every PII field.
- **Status flow** → the record's statuses and which action moves it between them, e.g. `new → in_review → closed | escalated → sar_filed`.
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
- **Assumptions** — every place the request was ambiguous, with the choice you made, e.g. "Exactly $10,000.00 needs no approval; $10,000.01 does." For approvals, PII and permissions always choose the stricter option. The engineer reviews these instead of the requester being asked.
- **Scenarios** — single steps, one plain-language sentence each, drafted from the form (who uses it, actions, approvals, sensitive data), e.g. "A refund of $500.01 waits for Finance Lead approval". Always include:
  - each role that should use the app can open it, and one role that shouldn't can't;
  - each action done by an allowed role, and refused for a role without permission;
  - every threshold at the boundary: exactly at it, and just over it;
  - every approval: it waits, then a named checker approves it (the requester can never approve their own; the harness checks that automatically);
  - every PII field masked by default; one role that can reveal it and one that can't;
  - required reason codes / notes, and actions blocked in the wrong status or after a deadline.
- **Journeys** — one record taken through the whole process by the real people involved, start to finish. Draft them from the form's process description and approval answers plus the status flow:
  1. the main path: the most common way a record goes from its first status to done;
  2. one per other ending: every final status in the status flow is reached by at least one journey;
  3. every handoff between roles (e.g. analyst escalates → compliance takes it);
  4. every approval inside a journey, both approved and rejected; the rejected journey continues to show what happens next (e.g. "rejected → stays in review → analyst escalates instead").

  Usually 2–5 per app. Don't repeat what single-step scenarios cover (each threshold, each refused role, PII masking); journeys check that the steps fit together. How to write each one:
  - start from a brand-new record in the first status (`given`), or with the step that creates it, never from a record set up halfway;
  - one plain sentence per step: who does what, in the requester's words for the process;
  - after each step, state what should be true (`then`: new status, who holds it) or that it waits for approval (`expect: "waits"`), and use `approve` / `reject` steps for the checker;
  - the harness checks at the end that the audit log lists every step in order with the right person, and that nothing is left waiting for approval.

**Write the scenarios and journeys as code now**, in `src/apps/<slug>/scenarios.ts` with `defineScenarios` (see `src/apps/kyc-review/scenarios.ts`): the engineer approves the tests, not a description of them.

Then open a **draft PR** so it lands in the engineers' **Requests dashboard** (`/requests` in the portal):
- branch `app-request/<ref>-<slug>`, and `App-Request: <ref>` in the PR description (the ref is in the request prompt; the dashboard finds the PR by it);
- the PR contains only `src/apps/<slug>/SPEC.md` and `scenarios.ts`. The dashboard renders `SPEC.md` for the engineer, so it must hold the whole spec above, with **Assumptions** near the top and the scenarios and journeys as checklists (`npm run scenarios -- <slug>` prints them);
- say you are waiting for an engineer, then STOP.

The engineer's decision arrives as a message in this session (and a PR comment): "Spec approved…" → Phase 2. "Changes requested…" → update `SPEC.md` / `scenarios.ts` on the same PR, push, and wait again. Do not build until approved.

## Phase 2 — Build
1. Create `src/apps/<slug>/app.ts` using `defineApp` (import only from `@/platform`).
2. Register it in `src/apps/registry.ts`.
3. New data: add source + table + seed data. External systems: add a mocked op in `src/connectors/external.ts`.
4. App-local logic goes in `handlers`. Add a `GAPS.md` row for every handler / unmet need; if the same gap already has an entry, this is the 2nd app: build it as a shared module instead (step 6).
5. The approved `scenarios.ts` is the acceptance test: `tests/scenarios.test.ts` runs every scenario and journey through the real platform. Add Vitest tests only for logic scenarios can't express (e.g. handler internals).
6. When a gap is hit by a 2nd app, or is compliance-critical, build it as a shared module: an optional option on an existing block (bump minor), or a new block via the `create-block` skill. Migrate the first app's handler to it and mark the GAPS.md row resolved.

## Phase 3 — Verify
```
npm run seed && npm run catalog && npm run graph && npm run check && npm run build
npm run graph -- --diff origin/main   # if you touched a block: bump its version (see AGENTS.md "Module versions")
npm start & npm run smoke && npm run journeys -- <slug>   # every page as every allowed role; then every journey played in the browser, one video each in journey-videos/
```
A failing scenario or journey means the app disagrees with what the engineer approved: fix the app, or go back to the engineer; never edit an approved scenario or journey to make it pass. (Stop the server before re-running `npm run seed`; a running server keeps the old data.)
Watch the journey videos yourself before handing over; also check PII is masked and reveals are audited, and that the audit log chain still verifies.

## Phase 4 — Hand the build to the engineer
Push the build to the same PR, update `SPEC.md` if the build changed anything, and **mark the PR ready for review**. That moves it to "Build & test" in the dashboard; CI runs every scenario and plays every journey in the browser, and the dashboard shows the engineer one video per journey with pass/fail, then "Ready to ship" once CI passes. Title `feat(app): <name>`. Description: the approved spec, the scenarios and journeys, the coverage table, the rung used for each customization, and GAPS.md changes. Watch the journey videos yourself (`npm run journeys -- <slug>` locally) before marking ready. An Eng Lead pushes to production from the dashboard (that merges the PR); never merge it yourself.
