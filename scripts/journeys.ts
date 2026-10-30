/**
 * Plays every journey in src/apps/<slug>/scenarios.ts through the real UI of a running server and records a video
 * of each: switches to each step's user, opens the page that shows the action, clicks it, fills reason/note,
 * and decides approvals in the Approvals tab. After each step it checks the record's fields; at the end, its audit trail.
 * Usage: npm start & npm run journeys [-- <slug>...]   (BASE_URL defaults to http://localhost:3000; videos → journey-videos/)
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { USERS, isJourney, listApprovals, type Journey, type ScenarioSet, type AppModule } from "@/platform";
import { makeRecord, resolveValues, expectedTrail, actualTrail } from "@/platform/scenario-records";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("journey-videos");
const args = process.argv.slice(2);
const slugs = args.length ? args : fs.readdirSync("src/apps").filter((d) => fs.existsSync(`src/apps/${d}/scenarios.ts`));
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The page to perform an action on: a record page (":id") whose blocks reference it, else any page that does. */
function pageFor(app: AppModule, actionId: string, recordId: string | null) {
  const uses = (p: AppModule["pages"][number]) => JSON.stringify(p.blocks).includes(`"${actionId}"`);
  const p = (recordId && app.pages.find((x) => x.path.includes(":") && uses(x))) || app.pages.find((x) => !x.path.includes(":") && uses(x));
  if (!p) throw new Error(`no page shows action "${actionId}"`);
  const rel = recordId ? p.path.replace(/:[a-zA-Z]+/, encodeURIComponent(recordId)) : p.path;
  return `/apps/${app.slug}${rel ? `/${rel}` : ""}`;
}

/** A record page for the journey's source, to show the final state and history. */
function recordPage(app: AppModule, source: string, recordId: string) {
  const p = app.pages.find((x) => x.path.includes(":") && x.blocks.some((b) => b.type === "record-detail" && (b.config as { source?: string }).source === source));
  return p && `/apps/${app.slug}/${p.path.replace(/:[a-zA-Z]+/, encodeURIComponent(recordId))}`;
}

async function caption(page: Page, title: string, line: string, tone: "step" | "ok" | "fail" = "step") {
  await page.evaluate(({ title, line, tone }) => {
    document.getElementById("__journey")?.remove();
    const d = document.createElement("div");
    d.id = "__journey";
    d.style.cssText = `position:fixed;left:16px;bottom:16px;z-index:9999;max-width:560px;padding:10px 14px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);background:${tone === "ok" ? "#047857" : tone === "fail" ? "#be123c" : "#0f172a"}`;
    d.innerHTML = `<div style="opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${title}</div><div style="font-weight:600;margin-top:2px">${line}</div>`;
    document.body.appendChild(d);
  }, { title, line, tone });
}

async function until(check: () => boolean, ms = 8000) {
  for (let t = 0; t < ms; t += 200) { if (check()) return true; await sleep(200); }
  return check();
}
const matches = (row: Record<string, unknown> | null | undefined, want: Record<string, unknown>) =>
  !!row && Object.entries(want).every(([k, v]) => String(row[k]) === String(v));

async function play(page: Page, app: AppModule, j: Journey) {
  const firstDo = j.steps.find((s) => "do" in s) as { do: string } | undefined;
  const sourceName = j.source ?? (firstDo && app.actions[firstDo.do]?.source);
  if (!sourceName) throw new Error("no action step to infer the source from");
  const src = getSource(sourceName);
  let recordId: string | null = j.given ? makeRecord(sourceName, j.given) : null;
  const ctx = page.context();

  for (const [i, step] of j.steps.entries()) {
    const user = USERS.find((u) => u.id === step.as)!;
    const title = `${app.name} · ${j.says}`;
    const line = `Step ${i + 1}/${j.steps.length} — ${step.says} <span style="opacity:.7">(as ${user.name}, ${user.title})</span>`;
    await ctx.addCookies([{ name: "uid", value: user.id, url: BASE }]);

    if ("approve" in step || "reject" in step) {
      await page.goto(`${BASE}/approvals`);
      await caption(page, title, line);
      const card = page.locator(`[data-approval-record="${recordId}"]`).first();
      await card.scrollIntoViewIfNeeded();
      await sleep(800);
      await card.getByRole("button", { name: "approve" in step ? /Approve/ : /Reject/ }).click();
      const want = "approve" in step ? "approved" : "rejected";
      if (!(await until(() => listApprovals({ status: want }).some((a) => a.record_id === recordId))))
        throw new Error(`step ${i + 1}: approval was not ${want}`);
    } else {
      const action = app.actions[step.do];
      const isCreate = action.effect.kind === "create";
      await page.goto(BASE + pageFor(app, step.do, isCreate ? null : recordId));
      await caption(page, title, line);
      const input = step.input ? resolveValues(step.input) : {};
      if (isCreate) for (const [k, v] of Object.entries(input)) {
        const el = page.locator(`main :is(input, select, textarea)[name="${k}"]`).first();
        if (await el.evaluate((e) => e.tagName === "SELECT")) await el.selectOption(String(v)); else await el.fill(String(v));
      }
      const btn = page.locator(`[data-action="${step.do}"][data-record="${isCreate ? "" : recordId}"]`).first();
      const before = recordId ? src.getRaw(recordId) : null;
      const existing = new Set(isCreate ? src.listRaw({ limit: 100000 }).map((r) => String(r[src.def.pk])) : []);
      if (step.expect === "blocked") {
        const offered = (await btn.count()) > 0 && (await btn.isEnabled());
        if (offered) throw new Error(`step ${i + 1}: "${action.label}" is still offered`);
        await caption(page, title, `${line}<br>✓ "${action.label}" is not offered`, "ok");
        await sleep(1500);
        if (JSON.stringify(src.getRaw(recordId!)) !== JSON.stringify(before)) throw new Error(`step ${i + 1}: record changed`);
        continue;
      }
      await btn.scrollIntoViewIfNeeded();
      await sleep(600);
      await btn.click();
      const reason = step.reason ?? action.reasonCodes?.[0];
      if (reason) await page.locator('select[name="reason"]').selectOption(reason);
      const note = step.note ?? (action.requireNote ? "Journey test" : "");
      if (note) await page.locator('textarea[name="note"]').fill(note);
      await sleep(600);
      await page.locator("[data-confirm]").click();
      if (step.expect === "waits") {
        if (!(await until(() => listApprovals({ status: "pending" }).some((a) => a.record_id === recordId && a.action_id === step.do))))
          throw new Error(`step ${i + 1}: no approval request was created`);
      } else if (isCreate) {
        const created = () => src.listRaw({ limit: 100000 }).find((r) => !existing.has(String(r[src.def.pk])) && matches(r, input));
        await until(() => !!created());
        const row = created();
        if (!row) throw new Error(`step ${i + 1}: record was not created`);
        recordId = String(row[src.def.pk]);
      } else if (!step.then) {
        await until(() => JSON.stringify(src.getRaw(recordId!)) !== JSON.stringify(before));
      }
    }
    if (step.then) {
      const want = resolveValues(step.then);
      if (!(await until(() => matches(src.getRaw(recordId!), want))))
        throw new Error(`step ${i + 1}: expected ${JSON.stringify(want)}, got ${JSON.stringify(src.getRaw(recordId!))}`);
    }
    await sleep(1200);
  }

  const want = expectedTrail(j.steps), got = actualTrail(sourceName, recordId!);
  const final = recordPage(app, sourceName, recordId!);
  if (final) await page.goto(BASE + final);
  if (JSON.stringify(want) !== JSON.stringify(got)) throw new Error(`audit trail: expected ${want.join(" → ")}, got ${got.join(" → ")}`);
  await caption(page, `${app.name} · ${j.says}`, `✓ Journey passed. Audit trail: ${got.map((g) => g.replace(" action.", " ").replace(" approval.", " approval ")).join(" → ")}`, "ok");
  await sleep(2500);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results: { app: string; journey: string; ok: boolean; error?: string; video: string }[] = [];
  for (const slug of slugs) {
    const set: ScenarioSet = (await import(path.resolve(`src/apps/${slug}/scenarios.ts`))).default;
    const app = getApp(set.app);
    for (const [n, j] of set.scenarios.filter(isJourney).entries()) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
      const page = await context.newPage();
      let error: string | undefined;
      try { await play(page, app, j); }
      catch (e) {
        error = (e as Error).message.split("\n")[0];
        await caption(page, `${app.name} · ${j.says}`, `✗ ${error}`, "fail").catch(() => {});
        await sleep(2500);
      }
      const video = page.video();
      await context.close();
      const file = `${slug}--${n + 1}-${slugify(j.says)}.webm`;
      if (video) fs.renameSync(await video.path(), path.join(OUT, file));
      results.push({ app: slug, journey: j.says, ok: !error, error, video: file });
      console.log(`${error ? "✗" : "✓"} ${slug}: ${j.says}${error ? `\n    ${error}` : ""}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.md"), `# Journey videos\n\n| App | Journey | Result | Video |\n|---|---|---|---|\n${results.map((r) => `| ${r.app} | ${r.journey} | ${r.ok ? "passed" : `FAILED: ${r.error}`} | ${r.video} |`).join("\n")}\n`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} journeys passed in the browser. Videos: ${path.relative(process.cwd(), OUT)}/`);
  if (failed) process.exit(1);
}
main();
