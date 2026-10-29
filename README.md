# Internal Tools on Devin — a Power Apps alternative (prototype)

Apps are **typed config files composed from reusable, governed blocks**. Devin builds new apps from plain-language requests using the skills in `.agents/skills/`, and the platform layer enforces fintech guardrails no matter what the app config says.

```
request (ops / compliance / eng) ──► Devin: build-internal-app skill
        │                              ├─ reads catalog.json + GAPS.md
        │                              ├─ spec + coverage table (covered / extend / app-local / new block)
        │                              └─ src/apps/<slug>/app.ts  ──► PR (CI: validate, boundaries, tests)
        ▼
 Portal ── app renderer ── blocks (L3) ── connectors (L2) ── platform (L0: RBAC, audit, PII, maker-checker)
```

## What's in the prototype
| Power Apps concept | Here |
|---|---|
| Canvas/model-driven app | `src/apps/<slug>/app.ts` — one `defineApp({...})` |
| Controls / components | 9 blocks in `src/blocks/` (data-grid, record-detail, review-queue, metric-cards, chart, toggle-matrix, form, audit-timeline, comments) each with a zod schema + manifest |
| Connectors | `src/connectors/` — table sources with PII tags; mocked Stripe & KYC vendor |
| Power Automate approvals | Declarative `approval` rules on actions → shared Approvals inbox (maker ≠ checker) |
| Environments / DLP / audit | Server-side RBAC, masked PII with audited reveal, hash-chained audit log, reason codes, idempotency |
| Maker experience | Devin + `build-internal-app` skill + `catalog.json`; ops/compliance use the **Request an app** page |

Rebuilt apps: **KYC Review Queue**, **Refunds Dashboard**, **Feature Flag Admin** — all pure config (+ one 4-line app-local handler).

## Run
```bash
source ~/.nvm/nvm.sh   # Node >= 22.5 (uses node:sqlite)
npm install
npm run seed           # synthetic data only
npm run dev            # http://localhost:3000 — switch users via the MOCK SSO dropdown
```
Optional: set `GITHUB_TOKEN` + `GITHUB_REPO` (files an issue per request) and/or `DEVIN_API_KEY` (starts a Devin session per request).

## Demo script
1. **Alice (KYC analyst)** → KYC queue → claim a high-risk case → Approve → goes to Approvals (needs Compliance).
2. **Carol (Compliance)** → Approvals → approve; reveal SSN on the case (audited).
3. **Bob (Ops lead)** → Refunds → issue a $120 refund (instant, mock Stripe) and a $2,000 one (needs Finance) → **Erin** approves.
4. **Dan (Engineer)** → enable a flag in prod → pending → **Priya** approves. Turning it off (kill switch) is instant.
5. **Audit log** → Verify integrity ✓ → `npm run tamper-demo` → Verify again ✗.
6. **Module catalog** → reuse matrix, block contracts, GAPS ledger.
7. **Request an app** → submit as an ops user → prompt handed to Devin.

## Checks
`npm run check` — typecheck, lint, layer boundaries, app config validation, catalog freshness, unit tests (RBAC, maker-checker, idempotency, PII, audit tamper detection).
