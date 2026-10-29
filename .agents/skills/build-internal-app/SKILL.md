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

If the request is ambiguous about approvals or PII, choose the stricter option and call it out.

## Phase 2 — Build
1. Create `src/apps/<slug>/app.ts` using `defineApp` (import only from `@/platform`).
2. Register it in `src/apps/registry.ts`.
3. New data: add source + table + seed data. External systems: add a mocked op in `src/connectors/external.ts`.
4. App-local logic goes in `handlers`. Add a `GAPS.md` row for every handler / unmet need; if the same gap already has an entry, bump its count and propose extraction.
5. Only create a new block (use the `create-block` skill) if a gap is hit for the 3rd time or is compliance-critical.

## Phase 3 — Verify
```
npm run seed && npm run catalog && npm run check && npm run build
```
Then `npm run dev`, switch through the relevant users in the mock-SSO dropdown, and verify: role visibility, each action, an approval round-trip (maker ≠ checker), PII masked + reveal audited, audit log chain still verifies.

## Phase 4 — PR
Title `feat(app): <name>`. Description: the spec, the coverage table, rung used for each customization, GAPS.md changes, screenshots.
