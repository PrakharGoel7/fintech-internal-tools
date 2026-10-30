import { describe, it, expect } from "vitest";
import { slaState } from "@/blocks/review-queue/sla";

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
