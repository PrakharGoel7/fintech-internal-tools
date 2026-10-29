import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, canDecide, getUser, ForbiddenError, listApprovals, listAudit, can } from "@/platform";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";

const app = getApp("merchant-onboarding");
const [alice, bob, carol, sam] = ["alice", "bob", "carol", "sam"].map(getUser);
const merchants = getSource("merchant_applications");

beforeAll(() => {
  const ins = getDb().prepare("INSERT INTO merchant_applications VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  ins.run("MER-T1", "Low Risk Bakery", "Test Person", "test.person@example.com", "US", "5411 Grocery stores", 20000, "low", "pending", null, now, now);
  ins.run("MER-T2", "High Risk Casino", "Big Player", "big.player@example.com", "MX", "7995 Gambling", 600000, "high", "pending", null, now, now);
  ins.run("MER-T3", "Unclear Imports", "Info Needed", "info.needed@example.com", "GB", "5999 Misc. retail", 40000, "medium", "pending", null, now, now);
});

describe("merchant-onboarding", () => {
  it("hides the app from support agents; compliance can view but not decide", () => {
    expect(can(sam, app, "view")).toBe(false);
    expect(can(carol, app, "view")).toBe(true);
    expect(can(carol, app, "decide")).toBe(false);
    expect(can(alice, app, "pii.reveal")).toBe(false);
  });

  it("masks contact name and email", () => {
    const r = merchants.get("MER-T1")!;
    expect(r.contact_email).not.toContain("test.person");
    expect(r.contact_name).not.toContain("Test");
  });

  it("claim then approve a low-risk merchant, with reason + note audited", async () => {
    await runAction({ user: alice, app, actionId: "claim", recordId: "MER-T1" });
    expect(merchants.getRaw("MER-T1")!).toMatchObject({ assignee: "alice", status: "in_review" });
    await expect(runAction({ user: alice, app, actionId: "approve", recordId: "MER-T1", reason: "kyb_verified" })).rejects.toThrow(/note/);
    const r = await runAction({ user: alice, app, actionId: "approve", recordId: "MER-T1", reason: "kyb_verified", note: "Registry + website checked" });
    expect(r.status).toBe("executed");
    expect(merchants.getRaw("MER-T1")!.status).toBe("approved");
    const ev = listAudit({ recordId: "MER-T1", action: "action.approve" })[0];
    expect(ev.actor).toBe("alice");
    expect(ev.reason).toBe("kyb_verified");
    expect(JSON.stringify(ev)).not.toContain("test.person@example.com");
  });

  it("request more info, then resume review", async () => {
    await runAction({ user: alice, app, actionId: "claim", recordId: "MER-T3" });
    await runAction({ user: alice, app, actionId: "requestInfo", recordId: "MER-T3", reason: "ownership_unclear", note: "Need UBO list" });
    expect(merchants.getRaw("MER-T3")!.status).toBe("needs_info");
    await expect(runAction({ user: alice, app, actionId: "approve", recordId: "MER-T3", reason: "kyb_verified", note: "x" })).rejects.toThrow();
    await runAction({ user: bob, app, actionId: "resume", recordId: "MER-T3", reason: "merchant_responded" });
    expect(merchants.getRaw("MER-T3")!).toMatchObject({ status: "in_review", assignee: "bob" });
  });

  it("high-risk approval needs Compliance sign-off; maker cannot self-approve", async () => {
    await expect(runAction({ user: sam, app, actionId: "claim", recordId: "MER-T2" })).rejects.toBeInstanceOf(ForbiddenError);
    await runAction({ user: alice, app, actionId: "claim", recordId: "MER-T2" });
    const r = await runAction({ user: alice, app, actionId: "approve", recordId: "MER-T2", reason: "compliance_reviewed", note: "Licensed operator" });
    expect(r.status).toBe("pending_approval");
    expect(merchants.getRaw("MER-T2")!.status).toBe("in_review");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "MER-T2")!;
    expect(canDecide(alice, a).ok).toBe(false);
    expect(canDecide(bob, a).ok).toBe(false);
    await decideApproval({ user: carol, approvalId: a.id, decision: "approve", getApp });
    expect(merchants.getRaw("MER-T2")!.status).toBe("approved");
    const ev = listAudit({ recordId: "MER-T2", action: "action.approve" })[0];
    expect(JSON.stringify(ev)).toContain("carol");
  });
});
