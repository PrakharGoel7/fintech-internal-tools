import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, canDecide, getUser, ForbiddenError, listApprovals, listAudit, can } from "@/platform";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";

const app = getApp("payout-reconciliation");
const [alice, erin, dan, priya, sam, bob, carol] = ["alice", "erin", "dan", "priya", "sam", "bob", "carol"].map(getUser);
const payouts = getSource("payouts");

beforeAll(() => {
  const ins = getDb().prepare("INSERT INTO payouts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  const row = (id: string, expected: number, received: number, status = "mismatch") =>
    ins.run(id, now.slice(0, 10), "USD", expected, received, received - expected, Math.abs(received - expected), `BNK-${id}`, status, null, null, null, now, now);
  row("po_small", 1000, 980);
  row("po_fee_big", 5000, 4600);
  row("po_wo_big", 9000, 8000);
  row("po_wo_small", 2000, 1900);
  row("po_over", 3000, 3400);
  row("po_ok", 1000, 1000, "matched");
});

describe("payout-reconciliation", () => {
  it("is visible to finance, ops analysts and engineers; hidden from support", () => {
    for (const u of [erin, alice, dan, priya]) expect(can(u, app, "view")).toBe(true);
    for (const u of [sam, bob, carol]) expect(can(u, app, "view")).toBe(false);
    expect(can(dan, app, "work")).toBe(false);
    expect(can(alice, app, "export")).toBe(false);
    expect(can(erin, app, "export")).toBe(true);
  });

  it("engineers cannot act", async () => {
    await expect(runAction({ user: dan, app, actionId: "investigate", recordId: "po_small" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("investigate, then resolve with a required note", async () => {
    await runAction({ user: alice, app, actionId: "investigate", recordId: "po_small" });
    expect(payouts.getRaw("po_small")).toMatchObject({ status: "investigating", assignee: "alice" });
    await expect(runAction({ user: alice, app, actionId: "resolveBankFee", recordId: "po_small" })).rejects.toThrow(/note/);
    const r = await runAction({ user: alice, app, actionId: "resolveBankFee", recordId: "po_small", note: "Wire fee per bank statement" });
    expect(r.status).toBe("executed");
    expect(payouts.getRaw("po_small")).toMatchObject({ status: "resolved", resolution: "bank_fee" });
    await expect(runAction({ user: alice, app, actionId: "writeOff", recordId: "po_small", reason: "unrecoverable", note: "x" })).rejects.toThrow(/not available/);
  });

  it("bank-fee resolution over $250 needs Finance Lead approval", async () => {
    const r = await runAction({ user: alice, app, actionId: "resolveBankFee", recordId: "po_fee_big", note: "Correspondent bank fee" });
    expect(r.status).toBe("pending_approval");
    expect(payouts.getRaw("po_fee_big")!.status).toBe("mismatch");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "po_fee_big")!;
    await decideApproval({ user: erin, approvalId: a.id, decision: "approve", getApp });
    expect(payouts.getRaw("po_fee_big")).toMatchObject({ status: "resolved", resolution: "bank_fee" });
  });

  it("write-off under $250 executes; over $250 needs a different Finance Lead (maker ≠ checker)", async () => {
    await expect(runAction({ user: alice, app, actionId: "writeOff", recordId: "po_wo_small", note: "x" })).rejects.toThrow(/reason code/);
    const small = await runAction({ user: alice, app, actionId: "writeOff", recordId: "po_wo_small", reason: "below_recovery_cost", note: "Not worth chasing" });
    expect(small.status).toBe("executed");
    expect(String(payouts.getRaw("po_wo_small")!.journal_entry_id)).toMatch(/^je_/);

    const big = await runAction({ user: alice, app, actionId: "writeOff", recordId: "po_wo_big", reason: "unidentified_deduction", note: "Bank cannot trace" });
    expect(big.status).toBe("pending_approval");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "po_wo_big")!;
    expect(canDecide(alice, a).ok).toBe(false);
    await decideApproval({ user: erin, approvalId: a.id, decision: "approve", getApp });
    expect(payouts.getRaw("po_wo_big")).toMatchObject({ status: "written_off", resolution: "write_off" });
    const ev = listAudit({ recordId: "po_wo_big", action: "action.writeOff" })[0];
    expect(ev.reason).toBe("unidentified_deduction");
    expect(JSON.stringify(ev.details)).toContain('"checker":"erin"');
  });

  it("Finance Lead cannot self-approve her own large write-off", async () => {
    const r = await runAction({ user: erin, app, actionId: "writeOff", recordId: "po_over", reason: "duplicate_or_error", note: "Overpayment" });
    expect(r.status).toBe("pending_approval");
    const a = listApprovals({ status: "pending" }).find((x) => x.record_id === "po_over")!;
    expect(canDecide(erin, a).ok).toBe(false);
  });

  it("timing resolution never needs approval", async () => {
    const r = await runAction({ user: alice, app, actionId: "resolveTiming", recordId: "po_over", note: "Bank reversed next day" });
    expect(r.status).toBe("executed");
  });
});
