# Internal Tools on Devin — a Power Apps alternative (prototype)

A platform for a fintech's internal apps. Each app is mostly a short config file that combines reusable, versioned blocks; every app shares one governance layer for permissions, approvals, PII masking and audit. Devin builds new apps from plain-language requests, and engineers approve the spec and the finished app.

The question this prototype tests: **can you keep the speed and consistency of a shared platform without limiting what each app can do?**

## How an app gets built
```
Request form (/request)          an ops / finance / compliance user describes the app
  → Devin drafts SPEC.md + scenarios + journeys   (reads catalog.json + GAPS.md; draft PR)
  → Engineer approves the spec   (/requests)
  → Devin builds src/apps/<slug>/app.ts
  → CI: checks, scenarios, a browser video of every journey
  → Eng Lead watches the videos and pushes to prod   (/requests → merges the PR)
```
Devin's instructions: [`.agents/skills/build-internal-app`](.agents/skills/build-internal-app/SKILL.md). Requesters are never asked questions; Devin records assumptions and the engineer approves them.

## Four design decisions

### 1. Apps are configuration
An app is one `defineApp({...})` call: permissions, actions and pages made of blocks. See [`src/apps/vendor-invoices/app.ts`](src/apps/vendor-invoices/app.ts) (133 lines, no app-specific code). Devin always takes the lowest rung of the **customization ladder** that works, and justifies rung 4+ in the PR:

1. Configure an existing block
2. Compose blocks on a page
3. App-local handler (logic only this app needs)
4. New connector / data source
5. Extend a block with a new optional, backwards-compatible option
6. New block (via the [`create-block`](.agents/skills/create-block/SKILL.md) skill)

A need no block covers is built app-locally and logged in [`GAPS.md`](GAPS.md). When a **second** app needs it, or it is compliance-critical, it becomes shared.

*Tradeoff:* forcing an unusual workflow into existing blocks can give a worse design than custom code; rung 3 exists for that.

### 2. Governance lives in one shared layer
Every mutation goes through one server-side pipeline in [`src/platform/actions.ts`](src/platform/actions.ts):
`RBAC → reason code → availability guard → idempotency → maker-checker → segregation of duties → execute → audit`.
Apps can't bypass it (`npm run boundaries` enforces the layering). Reads are permission-checked and PII fields are masked unless a user with the right role reveals them, which is audited. The audit log is hash-chained, so tampering is detectable.

*Tradeoff:* an app needing a new kind of access rule waits on a shared-layer change and its tests.

### 3. Blocks are versioned, with a dependency graph
Every block has a semver version. [`module-graph.json`](module-graph.json) (`npm run graph`) records which files each block is built from and which block versions each app uses. On every PR, CI fails if a block changed without a version bump, and lists the affected apps; it then retests every app. A fix is made once in a block, not copied between apps.

*Tradeoff:* a small change to a widely used block needs coordination across every app that uses it.

### 4. Engineers stay in the loop
The `/requests` dashboard is the engineer's view: the spec (assumptions, roles, pages, journeys) to approve or send back before the build, then CI status and a video of every journey before an Eng Lead pushes to prod. Devin never merges.

*Tradeoff:* review takes engineering time; reusing pre-tested blocks and watching journey videos keeps it short.

## Does reuse hold up?
Five apps, nine blocks. Chargebacks and Vendor Invoices were built from requests with **no new blocks**; each needed only a new data source.

| Block | KYC | Refunds | Feature Flags | Chargebacks | Vendor Invoices |
|---|---|---|---|---|---|
| `audit-timeline` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `record-detail` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `data-grid` | ✓ | ✓ | | ✓ | ✓ |
| `metric-cards` | ✓ | ✓ | | ✓ | ✓ |
| `comments` | ✓ | ✓ | | ✓ | ✓ |
| `review-queue` | ✓ | | | ✓ | ✓ |
| `form` | | ✓ | ✓ | | ✓ |
| `chart` | | ✓ | | ✓ | |
| `toggle-matrix` | | | ✓ | | |

What the new apps did need is in [`GAPS.md`](GAPS.md): one block option (`review-queue` deadline countdowns) and one shared platform rule (segregation of duties, `notBy`). The only app-local code across all five apps is one KYC handler.

## Repo map
| Layer | Path | What lives here |
|---|---|---|
| Platform | `src/platform/` | users/roles, RBAC, action pipeline, approvals, audit, PII, app schema, requests + GitHub |
| Connectors | `src/connectors/` | typed data sources with PII tags; mocked Stripe and KYC vendor |
| Blocks | `src/blocks/<name>/` | React component + `manifest.ts` (zod schema, version, use-when / not-for) |
| Apps | `src/apps/<slug>/` | `app.ts`, `scenarios.ts` (scenarios + journeys), `SPEC.md` |
| Portal | `src/app/` | gallery, app renderer, approvals, audit, module catalog, request form, requests dashboard |

Imports only flow downward. Rules for Devin and humans: [`AGENTS.md`](AGENTS.md).

## Run it
```bash
source ~/.nvm/nvm.sh   # Node >= 22.5 (uses node:sqlite)
npm install
npm run seed           # synthetic data only
npm run dev            # http://localhost:3000 — switch users via the MOCK SSO dropdown
```
Optional: set `GITHUB_TOKEN` + `GITHUB_REPO` (files an issue per request and powers the Requests dashboard) and/or `DEVIN_API_KEY` + `DEVIN_ORG_ID` (starts a Devin session per request via the v3 API; create the key under Settings > Devin API — a service user with `UseDevinSessions`, or a PAT). Without `DEVIN_ORG_ID` the legacy v1 endpoint is used.

## Walkthrough
1. **Module catalog** → each block's version and "Used by"; open Vendor Invoices and Chargebacks: same `review-queue`, different config.
2. **Request an app** (as Erin) → fill in the form, tick sensitive data → Devin session starts.
3. **Refunds** (as Bob) → email masked → issue a refund over $500 with a reason → **Approvals**: Bob can't approve his own → switch to **Erin**, approve → the record's history shows both.
4. **Requests** (as Dan) → review a spec → Approve spec & build.
5. **Requests** (as Priya) → Ready to ship: CI green, journey videos → Push to prod.

Also: **Audit log** → Verify integrity ✓ → `npm run tamper-demo` → Verify again ✗.

## Checks
`npm run check` — typecheck, lint, layer boundaries, app config validation, `catalog.json` and `module-graph.json` freshness, unit tests (RBAC, maker-checker, idempotency, PII, audit tamper detection) and every app's scenarios.
`npm start & npm run smoke && npm run journeys` — page loads, then every journey in a real browser with a video each.

## What's mocked
Synthetic data only; mock SSO user switcher; Stripe and the KYC vendor are mocked; SQLite. Open gaps (date picker, bulk actions, document viewer, …) are listed in [`GAPS.md`](GAPS.md).
