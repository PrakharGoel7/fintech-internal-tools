import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, canDecide, getUser, ForbiddenError, listApprovals, listAudit, verifyAuditChain, can, parseInputs, approvalRules, matchApproval, matches } from "@/platform";
import { getSource } from "@/connectors";
import { apps, getApp } from "@/apps/registry";
import { actionMeta } from "@/blocks/_shared/actions";
import type { BlockContext } from "@/blocks/types";

const app = getApp("limit-overrides");
const [sam, bob, carol, dan] = ["sam", "bob", "carol", "dan"].map(getUser);
const accounts = getSource("customer_accounts");
const ctxFor = (a: BlockContext["app"], user: BlockContext["user"]): BlockContext => ({ app: a, user, params: {}, search: {}, basePath: "", pathname: "", pageId: "", blockIndex: 0 });
const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const pendingFor = (id: string) => listApprovals({ status: "pending" }).find((a) => a.record_id === id)!;
const request = (recordId: string, limit: number, expiry = inDays(7)) =>
  runAction({ user: sam, app, actionId: "requestOverride", recordId, reason: "large_purchase", note: "customer buying a car", input: { override_limit: limit, override_expiry: expiry } });

beforeAll(() => {
  const ins = getDb().prepare("INSERT INTO customer_accounts VALUES (?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  for (const id of ["a_small", "a_big", "a_reject", "a_low", "a_far", "a_active", "a_expire", "a_meta"])
    ins.run(id, "Test Person", "test.person@example.com", 5000, null, null, "none", now, now);
  getDb().prepare("UPDATE customer_accounts SET override_status='active', override_limit=9000, override_expiry=? WHERE id IN ('a_active','a_expire')").run(inDays(5));
});

describe("limit-overrides", () => {
  it("engineers can view but not request or revoke", async () => {
    expect(can(dan, app, "view")).toBe(true);
    await expect(runAction({ user: dan, app, actionId: "requestOverride", recordId: "a_small", reason: "other", note: "x", input: { override_limit: 9000, override_expiry: inDays(3) } })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(runAction({ user: dan, app, actionId: "revokeOverride", recordId: "a_active", reason: "no_longer_needed" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("≤ $25k: marks the record requested, any ops-lead/compliance approver except the maker", async () => {
    expect((await request("a_small", 9000)).status).toBe("pending_approval");
    expect(accounts.getRaw("a_small")!.override_status).toBe("requested");
    const a = pendingFor("a_small");
    expect(a.approver_roles).toEqual(["ops-lead", "compliance"]);
    expect(canDecide(sam, a).ok).toBe(false);
    await decideApproval({ user: bob, approvalId: a.id, decision: "approve", getApp });
    const rec = accounts.getRaw("a_small")!;
    expect(rec.override_status).toBe("active");
    expect(rec.override_limit).toBe(9000);
  });

  it("> $25k: only Compliance can approve", async () => {
    expect((await request("a_big", 40000)).status).toBe("pending_approval");
    const a = pendingFor("a_big");
    expect(a.approver_roles).toEqual(["compliance"]);
    expect(canDecide(bob, a).ok).toBe(false);
    await decideApproval({ user: carol, approvalId: a.id, decision: "approve", getApp });
    expect(accounts.getRaw("a_big")!.override_status).toBe("active");
  });

  it("blocks a second request while one is pending; rejection sets rejected and allows a new request", async () => {
    await request("a_reject", 8000);
    await expect(request("a_reject", 8000)).rejects.toThrow(/not available/);
    await decideApproval({ user: bob, approvalId: pendingFor("a_reject").id, decision: "reject", note: "no docs", getApp });
    expect(accounts.getRaw("a_reject")!.override_status).toBe("rejected");
    expect((await request("a_reject", 8000)).status).toBe("pending_approval");
  });

  it("validates inputs at request time", async () => {
    await expect(runAction({ user: sam, app, actionId: "requestOverride", recordId: "a_low", reason: "other", note: "x", input: { override_expiry: inDays(3) } })).rejects.toThrow(/required/);
    await expect(runAction({ user: sam, app, actionId: "requestOverride", recordId: "a_low", reason: "other", note: "x", input: { override_limit: "lots", override_expiry: inDays(3) } })).rejects.toThrow(/number/);
    await expect(runAction({ user: sam, app, actionId: "requestOverride", recordId: "a_low", reason: "other", note: "x", input: { override_limit: 9000, override_expiry: "next week" } })).rejects.toThrow(/date/);
    expect(accounts.getRaw("a_low")!.override_status).toBe("none");
  });

  it("strips undeclared input fields", () => {
    const action = app.actions.requestOverride;
    expect(parseInputs(action, { override_limit: "9000", override_expiry: inDays(3), override_status: "active" })).toEqual({ override_limit: 9000, override_expiry: inDays(3) });
  });

  it("core banking rejects limits not above the current one and expiries beyond 30 days", async () => {
    await request("a_low", 4000);
    await expect(decideApproval({ user: bob, approvalId: pendingFor("a_low").id, decision: "approve", getApp })).rejects.toThrow(/exceed/);
    await request("a_far", 9000, inDays(45));
    await expect(decideApproval({ user: bob, approvalId: pendingFor("a_far").id, decision: "approve", getApp })).rejects.toThrow(/30 days/);
    expect(accounts.getRaw("a_far")!.override_status).toBe("requested");
  });

  it("revokes and expires active overrides without approval", async () => {
    expect((await runAction({ user: sam, app, actionId: "revokeOverride", recordId: "a_active", reason: "customer_request" })).status).toBe("executed");
    expect(accounts.getRaw("a_active")).toMatchObject({ override_status: "none", override_limit: null, override_expiry: null });
    await runAction({ user: bob, app, actionId: "expireOverride", recordId: "a_expire", reason: "expiry_reached" });
    expect(accounts.getRaw("a_expire")!.override_status).toBe("expired");
  });

  it("keeps PII out of the audit log and the chain verifies", () => {
    const events = listAudit({ app: "limit-overrides" });
    expect(events.some((e) => e.action === "approval.requested")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("test.person@example.com");
    expect(verifyAuditChain().ok).toBe(true);
  });

  it("shows all candidate approval rules in the dialog when they depend on inputs", () => {
    const meta = actionMeta(ctxFor(app, sam), "requestOverride", accounts.getRaw("a_meta"));
    expect(meta?.approvals.map((a) => a.approverRoles)).toEqual([["compliance"], ["ops-lead", "compliance"]]);
    expect(meta?.inputs.map((i) => i.field)).toEqual(["override_limit", "override_expiry"]);
  });
});

describe("backwards compatibility of the platform extensions", () => {
  const withApproval = apps.filter((a) => a.slug !== "limit-overrides").flatMap((a) => Object.entries(a.actions).filter(([, x]) => x.approval).map(([id, x]) => [`${a.slug}.${id}`, x] as const));

  it.each(withApproval)("%s: single approval rule normalizes to one rule with the same semantics", (_, action) => {
    const rules = approvalRules(action);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toBe(action.approval);
    for (const subject of [{ amount: 100, risk_score: 10, enabled_prod: 1 }, { amount: 5000, risk_score: 90, enabled_prod: 0 }])
      expect(matchApproval(action, subject) !== null).toBe(matches(rules[0].when, subject));
  });

  it("actions without inputs pass form input through unchanged", () => {
    const input = { charge_id: "ch_1", amount: 12, reason: "billing_error" };
    expect(parseInputs(getApp("refunds").actions.requestRefund, input)).toBe(input);
  });

  it("single-rule dialogs show exactly one rule, only when it applies", () => {
    const refunds = getApp("refunds");
    const ctx = ctxFor(refunds, getUser("bob"));
    expect(actionMeta(ctx, "issueRefund", { status: "requested", amount: 2400 })?.approvals).toEqual([{ rule: "Refunds over $500 require Finance Lead approval", approverRoles: ["finance-lead"] }]);
    expect(actionMeta(ctx, "issueRefund", { status: "requested", amount: 20 })?.approvals).toEqual([]);
  });
});
