import { describe, it, expect } from "vitest";
import { matches, resolveRelativeDate, conditionsSchema, describeConditions } from "@/platform";
import { aggregate } from "@/blocks/metric-cards/aggregate";
import { configSchema as metricSchema } from "@/blocks/metric-cards/manifest";
import { configSchema as chartSchema } from "@/blocks/chart/manifest";

const DAY = 86400000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

describe("relative-date condition token", () => {
  it("resolves $now, $now-Nd and $now+Nh", () => {
    const now = Date.parse("2026-01-10T00:00:00Z");
    expect(resolveRelativeDate("$now", now)).toBe(now);
    expect(resolveRelativeDate("$now-30d", now)).toBe(now - 30 * DAY);
    expect(resolveRelativeDate("$now+48h", now)).toBe(now + 48 * 3600000);
    expect(resolveRelativeDate("open", now)).toBeNull();
    expect(resolveRelativeDate(30, now)).toBeNull();
  });

  it("compares date fields (ISO timestamps and YYYY-MM-DD) against the token", () => {
    const within = [{ field: "d", op: "gte" as const, value: "$now-30d" }];
    expect(matches(within, { d: iso(5 * DAY) })).toBe(true);
    expect(matches(within, { d: iso(31 * DAY) })).toBe(false);
    expect(matches(within, { d: iso(5 * DAY).slice(0, 10) })).toBe(true);
    expect(matches(within, { d: null })).toBe(false);
    expect(matches(within, { d: "not a date" })).toBe(false);
    const dueSoon = [{ field: "d", op: "lte" as const, value: "$now+48h" }, { field: "d", op: "gt" as const, value: "$now" }];
    expect(matches(dueSoon, { d: iso(-24 * 3600000) })).toBe(true);
    expect(matches(dueSoon, { d: iso(-72 * 3600000) })).toBe(false);
  });

  it("leaves existing conditions unchanged", () => {
    expect(matches([{ field: "n", op: "gt", value: 250 }], { n: 300 })).toBe(true);
    expect(matches([{ field: "s", op: "eq", value: "$other" }], { s: "$other" })).toBe(true);
    expect(describeConditions([{ field: "d", op: "gte", value: "$now-30d" }])).toBe("d ≥ $now-30d");
  });

  it("rejects malformed tokens and non-ordering ops", () => {
    expect(conditionsSchema.safeParse([{ field: "d", op: "gte", value: "$now-30d" }]).success).toBe(true);
    expect(conditionsSchema.safeParse([{ field: "d", op: "gte", value: "$now-30days" }]).success).toBe(false);
    expect(conditionsSchema.safeParse([{ field: "d", op: "eq", value: "$now" }]).success).toBe(false);
  });
});

describe("ratio aggregate", () => {
  const rows = [{ s: "a" }, { s: "a" }, { s: "b" }];
  it("is the % of rows matching the numerator", () => {
    expect(aggregate(rows, "ratio", undefined, [{ field: "s", op: "eq", value: "a" }])).toBe(66.7);
    expect(aggregate(rows, "ratio", undefined, [{ field: "s", op: "eq", value: "z" }])).toBe(0);
    expect(aggregate([], "ratio", undefined, [{ field: "s", op: "eq", value: "a" }])).toBe(0);
  });

  it("keeps existing aggregates unchanged", () => {
    const nums = [{ v: 1 }, { v: 3 }];
    expect(aggregate(nums, "count")).toBe(2);
    expect(aggregate(nums, "sum", "v")).toBe(4);
    expect(aggregate(nums, "avg", "v")).toBe(2);
  });

  it("metric-cards and chart require numerator for ratio; old configs still parse", () => {
    const numerator = [{ field: "s", op: "eq", value: "a" }];
    expect(metricSchema.safeParse({ source: "x", metrics: [{ label: "r", agg: "ratio" }] }).success).toBe(false);
    expect(metricSchema.safeParse({ source: "x", metrics: [{ label: "r", agg: "ratio", numerator }] }).success).toBe(true);
    expect(metricSchema.safeParse({ source: "x", metrics: [{ label: "c", agg: "count" }] }).success).toBe(true);
    expect(chartSchema.safeParse({ source: "x", groupBy: "g", agg: "ratio" }).success).toBe(false);
    expect(chartSchema.safeParse({ source: "x", groupBy: "g", agg: "ratio", numerator }).success).toBe(true);
    expect(chartSchema.safeParse({ source: "x", groupBy: "g" }).success).toBe(true);
  });
});
