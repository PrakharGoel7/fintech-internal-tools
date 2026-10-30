import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { runAction, decideApproval, canDecide, listApprovals, revealPii, can, ForbiddenError, USERS, isJourney, type Scenario, type Journey, type ScenarioSet } from "@/platform";
import { makeRecord, resolveValues, expectedTrail, actualTrail } from "@/platform/scenario-records";
import { getSource } from "@/connectors";
import { apps, getApp } from "@/apps/registry";

const APPS_DIR = path.resolve(__dirname, "../src/apps");
const sets: ScenarioSet[] = [];
for (const slug of fs.readdirSync(APPS_DIR)) {
  const file = path.join(APPS_DIR, slug, "scenarios.ts");
  if (fs.existsSync(file)) sets.push((await import(file)).default);
}

const resolve = resolveValues;

function userOf(s: { says: string; as: string }) {
  const u = USERS.find((x) => x.id === s.as);
  if (!u) throw new Error(`Scenario "${s.says}": unknown user "${s.as}"`);
  return u;
}
const byId = (id: string) => USERS.find((u) => u.id === id)!;

async function runJourney(set: ScenarioSet, j: Journey) {
  const app = getApp(set.app);
  const first = j.steps.find((s) => "do" in s) as { do: string } | undefined;
  const sourceName = j.source ?? (first && app.actions[first.do]?.source);
  if (!sourceName) throw new Error(`Journey "${j.says}": no action step to infer its source from`);
  const src = getSource(sourceName);
  let recordId: string | null = j.given ? makeRecord(sourceName, j.given) : null;
  let pending: string | null = null;

  for (const [i, step] of j.steps.entries()) {
    const label = `Journey "${j.says}", step ${i + 1} ("${step.says}")`;
    const user = userOf(step);
    if ("approve" in step || "reject" in step) {
      expect(pending, `${label}: nothing is waiting for approval`).toBeTruthy();
      const approval = listApprovals().find((a) => a.id === pending)!;
      expect(canDecide(user, approval).ok, `${label}: ${user.name} cannot decide this approval`).toBe(true);
      const out = await decideApproval({ user, approvalId: approval.id, decision: "approve" in step ? "approve" : "reject", getApp });
      expect(out.status, label).toBe("approve" in step ? "approved" : "rejected");
      pending = null;
    } else {
      const action = app.actions[step.do];
      if (!action) throw new Error(`${label}: unknown action "${step.do}"`);
      const isCreate = action.effect.kind === "create";
      if (!isCreate && !recordId) throw new Error(`${label}: no record yet; add "given" or start with a create step`);
      const before = recordId ? src.getRaw(recordId) : null;
      const r = await runAction({
        user, app, actionId: step.do, recordId: isCreate ? null : recordId,
        reason: step.reason ?? action.reasonCodes?.[0], note: step.note ?? (action.requireNote ? "journey test" : undefined),
        input: step.input ? resolve(step.input) : undefined,
      }).catch((e: Error) => e);
      const want = step.expect ?? "done";
      if (want === "blocked") {
        expect(r, `${label}: should have been refused`).toBeInstanceOf(Error);
        expect(recordId ? src.getRaw(recordId) : null).toEqual(before);
      } else {
        if (r instanceof Error) throw new Error(`${label}: refused: ${r.message}`);
        expect(r.status, label).toBe(want === "waits" ? "pending_approval" : "executed");
        if (r.status === "executed" && isCreate) recordId = r.recordId;
        if (r.status === "pending_approval") {
          pending = r.approvalId;
          expect(src.getRaw(recordId!), `${label}: nothing changes until approved`).toEqual(before);
          expect(canDecide(user, listApprovals().find((a) => a.id === pending)!).ok, `${label}: requester cannot approve their own request`).toBe(false);
        }
      }
    }
    if (step.then) expect(src.getRaw(recordId!), label).toMatchObject(resolve(step.then));
  }
  expect(pending, `Journey "${j.says}" ends with a request still waiting for approval`).toBeNull();
  expect(actualTrail(sourceName, recordId!), `Journey "${j.says}": audit log`).toEqual(expectedTrail(j.steps));
}

async function run(set: ScenarioSet, s: Scenario | Journey) {
  if (isJourney(s)) return runJourney(set, s);
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

describe("every app has requester scenarios and at least one journey", () => {
  for (const a of apps) it(a.slug, () => {
    const set = sets.find((s) => s.app === a.slug);
    expect(set, `add src/apps/${a.slug}/scenarios.ts`).toBeTruthy();
    expect(set!.scenarios.some(isJourney), `add a journey to src/apps/${a.slug}/scenarios.ts`).toBe(true);
  });
});

for (const set of sets) {
  describe(`${set.app} scenarios`, () => {
    for (const s of set.scenarios) it(isJourney(s) ? `journey: ${s.says}` : s.says, () => run(set, s));
  });
}
