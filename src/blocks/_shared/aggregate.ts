/** Aggregates rows for metric-cards and chart: count | sum | avg | max | min. */
export function aggregate(rows: Record<string, unknown>[], agg: string, field?: string) {
  if (agg === "count") return rows.length;
  const vals = rows.map((r) => Number(r[field!])).filter((n) => !Number.isNaN(n));
  if (!vals.length) return 0;
  if (agg === "sum") return vals.reduce((a, b) => a + b, 0);
  if (agg === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === "max") return Math.max(...vals);
  return Math.min(...vals);
}
