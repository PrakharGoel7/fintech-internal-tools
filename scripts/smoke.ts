/**
 * Smoke test against a running server (CI: after build). Opens every page of every app as every user
 * allowed to view it, plus the portal pages, and fails on non-200s or error screens.
 * Usage: npm start & npm run smoke   (BASE_URL defaults to http://localhost:3000)
 */
import { USERS, can } from "@/platform";
import { apps } from "@/apps/registry";
import { getSource } from "@/connectors";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const failures: string[] = [];
let checked = 0;

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${BASE}`);
}

async function visit(url: string, uid: string) {
  checked++;
  const res = await fetch(BASE + url, { headers: { cookie: `uid=${uid}` } });
  const body = await res.text();
  if (res.status !== 200 || /Application error|Internal Server Error|Unhandled Runtime Error/.test(body)) failures.push(`${uid} ${url} → ${res.status}`);
}

async function main() {
await waitForServer();
for (const u of USERS) for (const p of ["/", "/approvals", "/audit", "/catalog", "/request"]) await visit(p, u.id);
for (const app of apps) {
  for (const u of USERS.filter((x) => can(x, app, "view"))) {
    for (const page of app.pages) {
      let p = page.path;
      if (p.includes(":")) {
        const block = page.blocks.find((b) => typeof (b.config as { source?: unknown }).source === "string");
        const sourceName = block && String((block.config as { source: string }).source);
        const row = sourceName ? getSource(sourceName).listRaw({ limit: 1 })[0] : undefined;
        if (!row) continue;
        p = p.replace(/:[a-zA-Z]+/, encodeURIComponent(String(row[getSource(sourceName!).def.pk])));
      }
      await visit(`/apps/${app.slug}${p ? `/${p}` : ""}`, u.id);
    }
  }
}
if (failures.length) {
  console.error(`Smoke test failed (${failures.length}/${checked}):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`Smoke test passed: ${checked} page loads`);
}
main();
