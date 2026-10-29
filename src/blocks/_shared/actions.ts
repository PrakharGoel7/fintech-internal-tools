import { can, matches, describeConditions, approvalRules, type ActionInput } from "@/platform";
import type { BlockContext } from "../types";

export interface ActionMeta {
  id: string;
  label: string;
  variant: "default" | "primary" | "danger";
  reasonCodes: string[];
  requireNote: boolean;
  allowed: boolean;
  /** Approval rules that may apply when executing (rules depending on inputs are listed until one surely applies). */
  approvals: { rule: string; approverRoles: string[] }[];
  inputs: ActionInput[];
}

/** Serializable action metadata for client components. Returns null when the action does not apply to the record. */
export function actionMeta(ctx: BlockContext, actionId: string, record: Record<string, unknown> | null): ActionMeta | null {
  const a = ctx.app.actions[actionId];
  if (!a) return null;
  if (record && !matches(a.availableWhen, record)) return null;
  const inputFields = new Set((a.inputs ?? []).map((i) => i.field));
  const approvals: ActionMeta["approvals"] = [];
  for (const r of approvalRules(a)) {
    const known = record ? r.when.filter((c) => !inputFields.has(c.field)) : [];
    if (!matches(known, record ?? {})) continue;
    approvals.push({ rule: r.description ?? describeConditions(r.when), approverRoles: r.approverRoles });
    if (known.length === r.when.length) break;
  }
  return {
    id: actionId,
    label: a.label,
    variant: a.variant,
    reasonCodes: a.reasonCodes ?? [],
    requireNote: !!a.requireNote,
    allowed: can(ctx.user, ctx.app, a.permission),
    approvals,
    inputs: a.inputs ?? [],
  };
}
