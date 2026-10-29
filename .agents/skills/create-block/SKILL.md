---
name: create-block
description: Add a new reusable L3 block to the catalog. Use only when GAPS.md shows a need recurring ≥3 times, or for a compliance-critical capability.
---

# Create a block

1. Confirm the need: cite the `GAPS.md` rows / apps that need it. If it is app-specific, stop and use an app handler instead.
2. Check the catalog: could an **optional config field on an existing block** cover it? Prefer that (backwards compatible, bump minor version).
3. Create `src/blocks/<name>/manifest.ts`:
   - zod `configSchema` (small, every field described; defaults for optional fields)
   - `summary`, `useWhen`, `notFor` written for an agent choosing between blocks
   - `requires` (platform guarantees), `emitsAudit`, `permissions`, a realistic `example`
4. Create the component `src/blocks/<name>/<Name>.tsx`. Rules:
   - read data via `@/connectors` (`source.list/get` → PII already masked); never import `@/platform/db` or `@/apps`
   - all mutations via `ActionButton` / server actions → `runAction` (never write directly)
   - render PII with `PiiValue`
   - stay domain-agnostic: no source/field names, thresholds or status values in the component. Anything app-specific is a config field (e.g. `badges: [{ when, label }]`, not `riskField` + a hard-coded 70)
5. Register in `src/blocks/manifests.ts` and `src/blocks/registry.ts`.
6. Migrate the app-local implementations listed in GAPS.md to the new block; mark those rows resolved.
7. `npm run catalog && npm run check && npm run build`. Add a test if the block has logic beyond rendering.
