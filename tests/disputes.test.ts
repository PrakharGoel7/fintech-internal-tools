import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, canDecide, getUser, ForbiddenError, listApprovals, listAudit, can } from "@/platform";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";
import { slaState } from "@/blocks/review-queue/sla";

const app = getApp("chargeback-disputes");
const [alice, bob, erin, sam] = ["alice", "bob", "erin", "sam"].map(getUser);
const disputes = getSource("disputes");

beforeAll(() => {
  const ins = getDb().prepare("INSERT INTO disputes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  const due = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
  ins.run("dp_small", "ch_a", "Test Person", "test.person@example.com", 250, "USD", "visa", "fraudulent", due(72), "needs_response", null, null, now, now);
  ins.run("dp_big", "ch_b", "Big Spender", "big.spender@example.com", 2400, "USD", "amex", "duplicate", due(72), "needs_response", null, null, now, now);
  ins.run("dp_late", "ch_c", "Late Person", "late@example.com", 90, "USD", "visa", "unrecognized", due(-1), "needs_response", null, null, now, now);
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
});

describe("review-queue sla", () => {
  const now = Date.parse("2026-01-10T00:00:00Z");
  it("deadline mode counts down to an absolute due date", () => {
    expect(slaState("2026-01-13T00:00:00Z", { hours: 48, mode: "deadline" }, now)).toMatchObject({ label: "3d left", cls: expect.stringContaining("slate") });
    expect(slaState("2026-01-11T00:00:00Z", { hours: 48, mode: "deadline" }, now)).toMatchObject({ label: "24h left", cls: expect.stringContaining("amber") });
    expect(slaState("2026-01-09T18:00:00Z", { hours: 48, mode: "deadline" }, now)).toMatchObject({ label: "Overdue 6h", cls: expect.stringContaining("rose") });
  });
  it("elapsed mode is unchanged", () => {
    expect(slaState("2026-01-09T00:00:00Z", { hours: 72, mode: "elapsed" }, now).label).toBe("48h left");
    expect(slaState("2026-01-05T00:00:00Z", { hours: 72, mode: "elapsed" }, now).label).toBe("SLA breached 48h");
  });
});
