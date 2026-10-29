/**
 * Architectural guardrails (run in CI):
 *  - apps/ may only import from @/platform (defineApp & types). No raw DB, no connectors, no React.
 *  - blocks/ must not import from apps/ and must not touch the DB directly (go through connectors).
 *  - Only platform/ and connectors/ may import node:sqlite or platform/db.
 */
import fs from "node:fs";
import path from "node:path";

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const imports = (f: string) => [...fs.readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
const errors: string[] = [];

for (const f of walk("src")) {
  if (!/\.(ts|tsx)$/.test(f)) continue;
  for (const imp of imports(f)) {
    if (f.startsWith("src/apps/") && !f.endsWith("registry.ts") && !(imp === "@/platform" || imp.startsWith("./")))
      errors.push(`${f}: apps may only import "@/platform" (found "${imp}")`);
    if (f.startsWith("src/blocks/") && (imp.startsWith("@/apps") || imp.includes("platform/db") || imp === "node:sqlite"))
      errors.push(`${f}: blocks must not import apps or the DB (found "${imp}")`);
    if (!f.startsWith("src/platform/") && !f.startsWith("src/connectors/") && (imp === "node:sqlite" || imp.endsWith("platform/db")))
      errors.push(`${f}: only platform/connectors may access the DB (found "${imp}")`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("boundaries ok");
