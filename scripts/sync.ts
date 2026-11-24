/**
 * Runs app syncs as a scheduled job (no user; audited as "system", changes as the connector's service account).
 * Usage: npm run sync [-- <slug>[:<syncId>]...]   (default: every sync of every app)
 */
import { runSync } from "@/platform";
import { apps, getApp } from "@/apps/registry";

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length
    ? args.flatMap((a) => { const [slug, id] = a.split(":"); const app = getApp(slug); return (id ? [id] : Object.keys(app.syncs)).map((s) => [app, s] as const); })
    : apps.flatMap((app) => Object.keys(app.syncs).map((s) => [app, s] as const));
  for (const [app, syncId] of targets) {
    const r = await runSync({ app, syncId });
    console.log(`${app.slug}:${syncId}: ${r.applied.length} applied, ${r.skipped.length} skipped`);
    for (const s of r.skipped) console.log(`  skipped ${s.recordId}: ${s.why}`);
  }
}
main();
