import { z } from "zod";

/**
 * Relative-date token for ordering ops (gt/gte/lt/lte) on date fields:
 * "$now", "$now-30d", "$now+48h". Resolved at evaluation time; the field is compared as a timestamp.
 */
const RELATIVE_DATE = /^\$now(?:([+-])(\d+)([hd]))?$/;
const UNIT_MS = { h: 3600000, d: 86400000 } as const;

export function resolveRelativeDate(value: unknown, now = Date.now()): number | null {
  if (typeof value !== "string") return null;
  const m = RELATIVE_DATE.exec(value);
  if (!m) return null;
  if (!m[1]) return now;
  return now + (m[1] === "-" ? -1 : 1) * Number(m[2]) * UNIT_MS[m[3] as keyof typeof UNIT_MS];
}

export const conditionSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn"]),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .describe('Relative dates for gt/gte/lt/lte: "$now", "$now-30d", "$now+48h"'),
}).refine(
  (c) => typeof c.value !== "string" || !c.value.startsWith("$now") || (RELATIVE_DATE.test(c.value) && ["gt", "gte", "lt", "lte"].includes(c.op)),
  { message: 'Relative date must look like "$now", "$now-30d" or "$now+48h" and use gt/gte/lt/lte' },
);
export type Condition = z.infer<typeof conditionSchema>;

/** Declarative conditions (all must match) – readable by ops reviewers and by Devin. */
export const conditionsSchema = z.array(conditionSchema);

export function matches(conds: Condition[] | undefined, row: Record<string, unknown>): boolean {
  if (!conds || conds.length === 0) return true;
  const now = Date.now();
  return conds.every((c) => {
    const v = row[c.field] as string | number | boolean;
    const at = resolveRelativeDate(c.value, now);
    if (at !== null && ["gt", "gte", "lt", "lte"].includes(c.op)) {
      const t = v === null || v === undefined || v === "" ? NaN : new Date(String(v)).getTime();
      if (Number.isNaN(t)) return false;
      return c.op === "gt" ? t > at : c.op === "gte" ? t >= at : c.op === "lt" ? t < at : t <= at;
    }
    switch (c.op) {
      case "eq": return v === c.value;
      case "neq": return v !== c.value;
      case "gt": return Number(v) > Number(c.value);
      case "gte": return Number(v) >= Number(c.value);
      case "lt": return Number(v) < Number(c.value);
      case "lte": return Number(v) <= Number(c.value);
      case "in": return Array.isArray(c.value) && (c.value as unknown[]).includes(v);
      case "notIn": return Array.isArray(c.value) && !(c.value as unknown[]).includes(v);
    }
  });
}

export function describeConditions(conds: Condition[] | undefined): string {
  if (!conds || conds.length === 0) return "always";
  const sym: Record<Condition["op"], string> = {
    eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", in: "in", notIn: "not in",
  };
  return conds
    .map((c) => `${c.field} ${sym[c.op]} ${Array.isArray(c.value) ? c.value.join("/") : String(c.value)}`)
    .join(" and ");
}
