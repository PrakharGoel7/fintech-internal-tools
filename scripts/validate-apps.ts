/** Validates every registered app against the block schemas and platform rules. Run in CI. */
import { apps } from "@/apps/registry";
import { validateApp } from "@/platform/validate";

let failed = 0;
for (const app of apps) {
  const errors = validateApp(app);
  if (errors.length) { failed++; console.error(`✗ ${app.slug}\n  - ${errors.join("\n  - ")}`); }
  else console.log(`✓ ${app.slug}`);
}
process.exit(failed ? 1 : 0);
