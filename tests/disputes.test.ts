import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, runSync, lastSyncs, decideApproval, canDecide, getUser, ForbiddenError, listApprovals, listAudit, can } from "@/platform";
import { validateApp } from "@/platform/validate";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";

const app = getApp("chargeback-disputes");
const [alice, bob, erin, sam] = ["alice", "bob", "erin", "sam"].map(getUser);
const disputes = getSource("disputes");

beforeAll(() => {
  const ins = getDb().prepare("INSERT INTO disputes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  const due = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
  ins.run("dp_small", "ch_a", "Test Person", "test.person@example.com", 250, "USD", "visa", "fraudulent", due(72), "needs_response", null, null, null, now, now);
  ins.run("dp_big", "ch_b", "Big Spender", "big.spender@example.com", 2400, "USD", "amex", "duplicate", due(72), "needs_response", null, null, null, now, now);
  ins.run("dp_late", "ch_c", "Late Person", "late@example.com", 90, "USD", "visa", "unrecognized", due(-1), "needs_response", null, null, null, now, now);
  ins.run("dp_review", "ch_d", "Review Person", "review@example.com", 400, "USD", "visa", "fraudulent", due(-24), "under_review", "alice", "evs_test", null, now, now);
  ins.run("dp_noevidence", "ch_e", "No Evidence", "none@example.com", 120, "USD", "visa", "duplicate", due(-24), "under_review", "alice", null, null, now, now);
});

describe("chargeback-disputes", () => {
  it("hides the app from support agents", () => {
    expect(can(sam, app, "view")).toBe(false);
    expect(can(erin, app, "view")).toBe(true);
  });

  it("masks customer name and email", () => {
    const r = disputes.get("dp_small")!;
    expect(r.customer_email).not.toContain("test.person");
    expect(r.customer_name).not.toContain("Test");
  });

  it("claim then contest via mocked Stripe, with evidence note in the audit log", async () => {
    await runAction({ user: alice, app, actionId: "claim", recordId: "dp_small" });
    expect(disputes.getRaw("dp_small")!.assignee).toBe("alice");
    await expect(runAction({ user: alice, app, actionId: "contest", recordId: "dp_small", reason: "proof_of_delivery" })).rejects.toThrow(/note/);
    const r = await runAction({ user: alice, app, actionId: "contest", recordId: "dp_small", reason: "proof_of_delivery", note: "UPS tracking + signed POD" });
    expect(r.status).toBe("executed");
    const rec = disputes.getRaw("dp_small")!;
    expect(rec.status).toBe("under_review");
    expect(String(rec.evidence_submission_id)).toMatch(/^evs_/);
    const ev = listAudit({ recordId: "dp_small", action: "action.contest" })[0];
    expect(ev.reason).toBe("proof_of_delivery");
    expect(JSON.stringify(ev)).toContain("UPS tracking");
  });

  it("rejects evidence after the deadline", async () => {
    await expect(runAction({ user: alice, app, actionId: "contest", recordId: "dp_late", reason: "receipt_or_invoice", note: "x" })).rejects.toThrow(/deadline/);
  });

  it("write-offs over $1,000 need a Finance Lead; maker cannot self-approve", async () => {
    await expect(runAction({ user: sam, app, actionId: "accept", recordId: "dp_big", reason: "merchant_error", note: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    const r = await runAction({ user: bob, app, actionId: "accept", recordId: "dp_big", reason: "cost_exceeds_recovery", note: "no delivery proof" });
    expect(r.status).toBe("pending_approval");
    expect(disputes.getRaw("dp_big")!.status).toBe("needs_response");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "dp_big")!;
    expect(canDecide(bob, a).ok).toBe(false);
    expect(canDecide(alice, a).ok).toBe(false);
    await decideApproval({ user: erin, approvalId: a.id, decision: "approve", getApp });
    expect(disputes.getRaw("dp_big")!.status).toBe("accepted");
  });

  describe("Stripe outcome sync", () => {
    const decided = () => disputes.listRaw({ where: [{ field: "status", op: "in", value: ["won", "lost"] }] });

    it("only people with the work permission can run it by hand", async () => {
      await expect(runSync({ app, syncId: "stripeOutcomes", user: erin })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("records Stripe's ruling on contested disputes as the Stripe service account", async () => {
      expect(disputes.getRaw("dp_review")!.status).toBe("under_review");
      const r = await runSync({ app, syncId: "stripeOutcomes", user: alice });
      expect(r.applied.map((a) => a.recordId)).toContain("dp_review");
      const rec = disputes.getRaw("dp_review")!;
      expect(["won", "lost"]).toContain(rec.status);
      expect(rec.win_pct).toBe(rec.status === "won" ? 100 : 0);
      const ev = listAudit({ recordId: "dp_review" })[0];
      expect(ev.actor).toBe("stripe-sync");
      expect(ev.action).toBe(`action.${rec.status === "won" ? "recordWon" : "recordLost"}`);
      expect(listAudit({ app: app.slug, action: "sync.stripeOutcomes" })[0].actor).toBe("alice");
      expect(lastSyncs(app).stripeOutcomes).toBeTruthy();
    });

    it("leaves disputes without submitted evidence alone, and a second run changes nothing", async () => {
      const before = decided().length;
      const r = await runSync({ app, syncId: "stripeOutcomes" });
      expect(r.applied).toEqual([]);
      expect(decided().length).toBe(before);
      expect(disputes.getRaw("dp_noevidence")!.status).toBe("under_review");
      expect(listAudit({ app: app.slug, action: "sync.stripeOutcomes" })[0].actor).toBe("system");
    });

    it("rejects syncs mapped to actions that need a reason, note or approval", () => {
      const bad = { ...app, syncs: { s: { ...app.syncs.stripeOutcomes, actions: { lost: "accept", won: "ghost" } } } };
      const errs = validateApp(bad).join("\n");
      expect(errs).toMatch(/accept needs a reason code, note or approval/);
      expect(errs).toMatch(/undefined action "ghost"/);
    });
  });
});
