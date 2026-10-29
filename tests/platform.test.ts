import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, canDecide, revealPii, listAudit, verifyAuditChain, getUser, ForbiddenError, listApprovals } from "@/platform";
import { validateApp } from "@/platform/validate";
import { getSource } from "@/connectors";
import { apps, getApp } from "@/apps/registry";

const refunds = getApp("refunds");
const flags = getApp("feature-flags");
const [sam, bob, erin, dan, priya] = ["sam", "bob", "erin", "dan", "priya"].map(getUser);

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  const ins = db.prepare("INSERT INTO refunds VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  ins.run("r_small", "ch_1", "Test Person", "test.person@example.com", 120, "USD", "billing_error", "requested", null, "sam", now, now);
  ins.run("r_big", "ch_2", "Big Spender", "big.spender@example.com", 2400, "USD", "fraudulent", "requested", null, "sam", now, now);
  ins.run("r_idem", "ch_3", "Idem Potent", "idem@example.com", 50, "USD", "billing_error", "requested", null, "sam", now, now);
  db.prepare("INSERT INTO feature_flags VALUES (?,?,?,?,?,?,?,?,?)").run("f1", "test flag", "risk", 1, 1, 0, 0, now, now);
});

describe("guarded actions", () => {
  it("enforces RBAC server-side", async () => {
    await expect(runAction({ user: sam, app: refunds, actionId: "issueRefund", recordId: "r_small", reason: "goodwill" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires a reason code", async () => {
    await expect(runAction({ user: bob, app: refunds, actionId: "issueRefund", recordId: "r_small" })).rejects.toThrow(/reason code/);
  });

  it("executes small refunds immediately via the (mock) Stripe connector", async () => {
    const r = await runAction({ user: bob, app: refunds, actionId: "issueRefund", recordId: "r_small", reason: "goodwill" });
    expect(r.status).toBe("executed");
    const rec = getSource("refunds").getRaw("r_small")!;
    expect(rec.status).toBe("issued");
    expect(String(rec.stripe_refund_id)).toMatch(/^re_/);
  });

  it("blocks actions whose availability guard fails", async () => {
    await expect(runAction({ user: bob, app: refunds, actionId: "issueRefund", recordId: "r_small", reason: "goodwill" })).rejects.toThrow(/not available/);
  });

  it("routes large refunds through maker-checker; maker cannot self-approve", async () => {
    const r = await runAction({ user: bob, app: refunds, actionId: "issueRefund", recordId: "r_big", reason: "fraud_confirmed" });
    expect(r.status).toBe("pending_approval");
    expect(getSource("refunds").getRaw("r_big")!.status).toBe("requested");
    const approval = listApprovals({ status: "pending" }).find((a) => a.record_id === "r_big")!;
    expect(canDecide(bob, approval).ok).toBe(false);
    await expect(decideApproval({ user: bob, approvalId: approval.id, decision: "approve", getApp })).rejects.toThrow();
    await decideApproval({ user: erin, approvalId: approval.id, decision: "approve", getApp });
    expect(getSource("refunds").getRaw("r_big")!.status).toBe("issued");
  });

  it("is idempotent for retried submissions", async () => {
    const args = { user: bob, app: refunds, actionId: "issueRefund", recordId: "r_idem", reason: "goodwill", idempotencyKey: "k-1" };
    await runAction(args);
    await runAction(args);
    expect(listAudit({ recordId: "r_idem", action: "action.issueRefund" }).length).toBe(1);
  });

  it("prod flag: enabling needs approval, disabling (kill switch) is immediate", async () => {
    const on = await runAction({ user: dan, app: flags, actionId: "toggleProd", recordId: "f1", reason: "planned_release", note: "launch" });
    expect(on.status).toBe("pending_approval");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "f1")!;
    await decideApproval({ user: priya, approvalId: a.id, decision: "approve", getApp });
    expect(getSource("feature_flags").getRaw("f1")!.enabled_prod).toBe(1);
    const off = await runAction({ user: dan, app: flags, actionId: "toggleProd", recordId: "f1", reason: "incident_mitigation", note: "errors spiking" });
    expect(off.status).toBe("executed");
    expect(getSource("feature_flags").getRaw("f1")!.enabled_prod).toBe(0);
  });
});

describe("PII", () => {
  it("masks PII by default and audits permitted reveals", () => {
    expect(getSource("refunds").get("r_small")!.email).not.toContain("test.person");
    expect(() => revealPii({ user: sam, app: refunds, source: "refunds", recordId: "r_small", field: "email" })).toThrow(ForbiddenError);
    expect(revealPii({ user: erin, app: refunds, source: "refunds", recordId: "r_small", field: "email" })).toBe("test.person@example.com");
    const ev = listAudit({ action: "pii.revealed" })[0];
    expect(ev.actor).toBe("erin");
    expect(JSON.stringify(ev)).not.toContain("test.person@example.com");
  });
});

describe("audit chain", () => {
  it("verifies, then detects tampering", () => {
    expect(verifyAuditChain().ok).toBe(true);
    getDb().prepare("UPDATE audit_log SET actor='mallory' WHERE id = (SELECT MIN(id) FROM audit_log)").run();
    expect(verifyAuditChain().ok).toBe(false);
  });
});

describe("app configs", () => {
  it.each(apps.map((a) => [a.slug, a] as const))("%s is valid", (_, app) => {
    expect(validateApp(app)).toEqual([]);
  });

  it("catches broken references", () => {
    const bad = { ...refunds, pages: [{ ...refunds.pages[0], blocks: [{ type: "data-grid", width: "full" as const, config: { source: "nope", columns: ["x"], rowActions: ["ghost"] } }] }] };
    const errs = validateApp(bad);
    expect(errs.join("\n")).toMatch(/unknown source "nope"/);
    expect(errs.join("\n")).toMatch(/undefined action "ghost"/);
  });
});
