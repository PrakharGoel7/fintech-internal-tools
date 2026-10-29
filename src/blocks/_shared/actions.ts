import { can, matches, describeConditions } from "@/platform";
import type { BlockContext } from "../types";

export interface ActionMeta {
  id: string;
  label: string;
  variant: "default" | "primary" | "danger";
  reasonCodes: string[];
  requireNote: boolean;
  allowed: boolean;
  /** Set when executing would route to maker-checker approval. */
  approvalRule: string | null;
  approverRoles: string[];
}

/** Serializable action metadata for client components. Returns null when the action does not apply to the record. */
export function actionMeta(ctx: BlockContext, actionId: string, record: Record<string, unknown> | null): ActionMeta | null {
  const a = ctx.app.actions[actionId];
  if (!a) return null;
  if (record && !matches(a.availableWhen, record)) return null;
  const approvalApplies = !!a.approval && (record ? matches(a.approval.when, record) : true);
  return {
    id: actionId,
    label: a.label,
    variant: a.variant,
    reasonCodes: a.reasonCodes ?? [],
    requireNote: !!a.requireNote,
    allowed: can(ctx.user, ctx.app, a.permission),
    approvalRule: approvalApplies && a.approval ? (a.approval.description ?? describeConditions(a.approval.when)) : null,
    approverRoles: a.approval?.approverRoles ?? [],
  };
}
