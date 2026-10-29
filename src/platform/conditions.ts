import { z } from "zod";

export const conditionSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});
export type Condition = z.infer<typeof conditionSchema>;

/** Declarative conditions (all must match) – readable by ops reviewers and by Devin. */
export const conditionsSchema = z.array(conditionSchema);

export function matches(conds: Condition[] | undefined, row: Record<string, unknown>): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => {
    const v = row[c.field] as string | number | boolean;
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
