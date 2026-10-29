import { matches, type Condition } from "@/platform";

/** `ratio`: share of `rows` matching `numerator`, as a percentage (0–100, 1 decimal); 0 when there are no rows. */
export function aggregate(rows: Record<string, unknown>[], agg: string, field?: string, numerator?: Condition[]) {
  if (agg === "count") return rows.length;
  if (agg === "ratio") return rows.length ? Math.round((rows.filter((r) => matches(numerator, r)).length / rows.length) * 1000) / 10 : 0;
  const vals = rows.map((r) => Number(r[field!])).filter((n) => !Number.isNaN(n));
  if (!vals.length) return 0;
  if (agg === "sum") return vals.reduce((a, b) => a + b, 0);
  if (agg === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === "max") return Math.max(...vals);
  return Math.min(...vals);
}
