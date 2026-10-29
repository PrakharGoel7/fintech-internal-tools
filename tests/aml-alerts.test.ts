import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/platform/db";
import { runAction, decideApproval, listAudit, getUser } from "@/platform";
import { getSource } from "@/connectors";
import { getApp } from "@/apps/registry";

const app = getApp("aml-alerts");
const [carol, grace] = ["carol", "grace"].map(getUser);
const alerts = getSource("aml_alerts");

beforeAll(() => {
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO aml_alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("alr_t1", "Test Person", "test.person@example.com", "123456789012", 4200, "structuring_cash", 88, "escalated", "carol", now, null, now);
});

describe("aml-alerts", () => {
  it("a SAR approved by a second officer gets a simulated SAR reference; maker and checker are both audited", async () => {
    const r = await runAction({ user: carol, app, actionId: "fileSar", recordId: "alr_t1", reason: "structuring", note: "Repeated sub-threshold cash deposits" });
    expect(r.status).toBe("pending_approval");
    if (r.status !== "pending_approval") return;
    expect(alerts.getRaw("alr_t1")!.sar_reference).toBeNull();
    await decideApproval({ user: grace, approvalId: r.approvalId, decision: "approve", getApp });
    const row = alerts.getRaw("alr_t1")!;
    expect(row.status).toBe("sar_filed");
    expect(String(row.sar_reference)).toMatch(/^sar_[0-9a-f]{12}$/);
    const entry = listAudit({ app: "aml-alerts" }).find((e) => e.action === "action.fileSar" && e.record_id === "alr_t1")!;
    expect(entry.details).toMatchObject({ maker: "carol", checker: "grace" });
    expect(JSON.stringify(entry.details)).not.toContain("123456789012");
  });
});
