import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { runAction, decideApproval, canDecide, listApprovals, revealPii, can, ForbiddenError, USERS, type Scenario, type ScenarioSet } from "@/platform";
import { getSource } from "@/connectors";
import { apps, getApp } from "@/apps/registry";

type Values = Record<string, unknown>;
const APPS_DIR = path.resolve(__dirname, "../src/apps");
const sets: ScenarioSet[] = [];
for (const slug of fs.readdirSync(APPS_DIR)) {
  const file = path.join(APPS_DIR, slug, "scenarios.ts");
  if (fs.existsSync(file)) sets.push((await import(file)).default);
}

const resolveTime = (v: unknown) => {
  const m = typeof v === "string" && v.match(/^\$now(?:([+-]\d+)([hd]))?$/);
  if (!m) return v;
  const ms = m[1] ? Number(m[1]) * (m[2] === "d" ? 86400000 : 3600000) : 0;
  return new Date(Date.now() + ms).toISOString();
};
const resolve = (vals: Values = {}) => Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, resolveTime(v)]));

let seq = 0;
function makeRecord(sourceName: string, given?: Values): string {
  const src = getSource(sourceName);
  const now = new Date().toISOString();
  const row: Values = {};
  for (const [k, f] of Object.entries(src.def.fields)) {
    row[k] = ["number", "currency", "boolean"].includes(f.type) ? 0 : f.type === "date" ? now : f.type === "status" ? null : `${k}-${seq + 1}@example.test`;
  }
  row[src.def.pk] = `scn_${++seq}`;
  Object.assign(row, resolve(given));
  return String(src.create(row)[src.def.pk]);
}

function userOf(s: Scenario) {
  const u = USERS.find((x) => x.id === s.as);
  if (!u) throw new Error(`Scenario "${s.says}": unknown user "${s.as}"`);
  return u;
}
const byId = (id: string) => USERS.find((u) => u.id === id)!;

async function run(set: ScenarioSet, s: Scenario) {
  const app = getApp(set.app);
  const user = userOf(s);
  if ("open" in s) return expect(can(user, app, "view")).toBe(s.expect === "allowed");

  if ("masked" in s || "reveal" in s) {
    if (!s.source) throw new Error(`Scenario "${s.says}": "source" is required`);
    const src = getSource(s.source);
    const id = makeRecord(s.source, s.given);
    const raw = src.getRaw(id)!, shown = src.get(id)!;
    if ("masked" in s) {
      for (const f of s.masked) expect(shown[f], `${f} should be masked`).not.toEqual(raw[f]);
      return;
    }
    const reveal = () => revealPii({ user, app, source: s.source!, recordId: id, field: s.reveal });
    return s.expect === "allowed" ? expect(reveal()).toBe(raw[s.reveal]) : expect(reveal).toThrow(ForbiddenError);
  }

  const action = app.actions[s.do];
  if (!action) throw new Error(`Scenario "${s.says}": unknown action "${s.do}"`);
  const src = getSource(s.source ?? action.source);
  const isCreate = action.effect.kind === "create";
  const recordId = isCreate ? null : makeRecord(src.def.name, s.given);
  const before = recordId ? src.getRaw(recordId) : null;
  const attempt = () => runAction({
    user, app, actionId: s.do, recordId,
    reason: s.reason ?? action.reasonCodes?.[0], note: s.note ?? (action.requireNote ? "scenario test" : undefined),
    input: isCreate ? { ...resolve(s.given), ...s.input } : s.input,
  });
  const after = (id: string | null) => (id ? src.getRaw(id) : null);

  if (s.expect === "denied" || s.expect === "blocked") {
    const err = await attempt().then(() => null, (e: Error) => e);
    expect(err, "action should have been refused").toBeTruthy();
    if (s.expect === "denied") expect(err).toBeInstanceOf(ForbiddenError);
    else expect(err).not.toBeInstanceOf(ForbiddenError);
    if ("because" in s && s.because) expect(err!.message).toMatch(new RegExp(s.because, "i"));
    return expect(after(recordId)).toEqual(before);
  }

  const r = await attempt();
  if (s.expect === "allowed") {
    expect(r.status).toBe("executed");
    if (s.then && r.status === "executed") expect(after(r.recordId)).toMatchObject(resolve(s.then));
    return;
  }

  const na = s as Extract<Scenario, { expect: "needs-approval" }>;
  expect(r.status).toBe("pending_approval");
  if (r.status !== "pending_approval") return;
  expect(after(recordId), "nothing changes until approved").toEqual(before);
  const approval = listApprovals().find((a) => a.id === r.approvalId)!;
  expect(canDecide(user, approval).ok, "requester cannot approve their own request").toBe(false);
  if (na.approvers) expect([...approval.approver_roles].sort()).toEqual([...na.approvers].sort());
  const decider = na.approvedBy ?? na.rejectedBy;
  if (!decider) return;
  const out = await decideApproval({ user: byId(decider), approvalId: approval.id, decision: na.approvedBy ? "approve" : "reject", getApp });
  if (na.then) expect(after("recordId" in out && out.recordId ? out.recordId : recordId)).toMatchObject(resolve(na.then));
  else if (na.rejectedBy) expect(after(recordId)).toEqual(before);
}

describe("every app has requester scenarios", () => {
  for (const a of apps) it(a.slug, () => expect(sets.some((s) => s.app === a.slug), `add src/apps/${a.slug}/scenarios.ts`).toBe(true));
});

for (const set of sets) {
  describe(`${set.app} scenarios`, () => {
    for (const s of set.scenarios) it(s.says, () => run(set, s));
  });
}
