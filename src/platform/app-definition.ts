import { z } from "zod";
import { ROLES, type User } from "./users";
import { conditionsSchema, matches } from "./conditions";

const roleSchema = z.enum(ROLES);
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const effectSchema = z.discriminatedUnion("kind", [
  /** Set fields. String values "$user" and "$now" are replaced at run time. */
  z.object({ kind: z.literal("update"), set: z.record(scalar) }),
  /** Flip a boolean (0/1) field. */
  z.object({ kind: z.literal("toggle"), field: z.string() }),
  /** Call an L2 connector operation, e.g. stripe.refund. Returns a patch to apply. */
  z.object({ kind: z.literal("connector"), connector: z.string(), op: z.string() }),
  /** Call an app-local handler (customization ladder rung 3). */
  z.object({ kind: z.literal("handler"), name: z.string() }),
  /** Create a new record from form input merged with defaults. */
  z.object({ kind: z.literal("create"), defaults: z.record(scalar).default({}) }),
]);
export type Effect = z.infer<typeof effectSchema>;

export const approvalRuleSchema = z.object({
  when: conditionsSchema,
  approverRoles: z.array(roleSchema).min(1),
  description: z.string().optional(),
});
export type ApprovalRule = z.infer<typeof approvalRuleSchema>;

/** A value collected in the action dialog and passed to the effect as `input`. */
export const actionInputSchema = z.object({
  field: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "number", "date"]).default("text"),
  required: z.boolean().default(true),
});
export type ActionInput = z.infer<typeof actionInputSchema>;

export const actionSchema = z.object({
  label: z.string(),
  source: z.string(),
  permission: z.string(),
  effect: effectSchema,
  /** Required reason codes; the user must pick one (recorded in the audit log). */
  reasonCodes: z.array(z.string()).optional(),
  requireNote: z.boolean().optional(),
  /** The action is only offered/allowed when the record matches. */
  availableWhen: conditionsSchema.optional(),
  /** Typed inputs collected in the action dialog. When set, only these fields are accepted as `input`. */
  inputs: z.array(actionInputSchema).optional(),
  /**
   * Maker-checker: if the record (merged with `input`) matches `when`, a second person must approve.
   * A list of rules is evaluated in order; the first match wins.
   */
  approval: z.union([approvalRuleSchema, z.array(approvalRuleSchema).min(1)]).optional(),
  /** Record field updated by `pendingStatus` / `rejectedStatus`. */
  statusField: z.string().default("status"),
  /** Set on the record while its approval is pending. */
  pendingStatus: z.string().optional(),
  /** Set on the record when its approval is rejected. */
  rejectedStatus: z.string().optional(),
  variant: z.enum(["default", "primary", "danger"]).default("default"),
});
export type ActionDef = z.infer<typeof actionSchema>;

export function approvalRules(action: Pick<ActionDef, "approval">): ApprovalRule[] {
  return !action.approval ? [] : Array.isArray(action.approval) ? action.approval : [action.approval];
}

export function matchApproval(action: Pick<ActionDef, "approval">, subject: Record<string, unknown>): ApprovalRule | null {
  return approvalRules(action).find((r) => matches(r.when, subject)) ?? null;
}

export const blockInstanceSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  width: z.enum(["full", "half", "third", "two-thirds"]).default("full"),
  config: z.record(z.unknown()),
});
export type BlockInstance = z.infer<typeof blockInstanceSchema>;

export const pageSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** e.g. "" (home), "queue", "items/:id" */
  path: z.string(),
  nav: z.boolean().default(true),
  blocks: z.array(blockInstanceSchema).min(1),
});
export type PageDef = z.infer<typeof pageSchema>;

export const appSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.enum(["operations", "compliance", "finance", "engineering", "support"]),
  owners: z.array(z.string()).min(1),
  /** permission → roles. Must include "view". Conventional keys: view, export, pii.reveal, comment. */
  permissions: z.record(z.array(roleSchema)).refine((p) => "view" in p, "permissions.view is required"),
  actions: z.record(actionSchema).default({}),
  pages: z.array(pageSchema).min(1),
});
export type AppDef = z.infer<typeof appSchema>;

export interface HandlerContext {
  record: Record<string, unknown> | null;
  input: Record<string, unknown>;
  user: User;
}
export type Handler = (ctx: HandlerContext) => Record<string, unknown> | Promise<Record<string, unknown>>;

export type AppModule = AppDef & { handlers?: Record<string, Handler> };

export type AppInput = z.input<typeof appSchema> & { handlers?: Record<string, Handler> };

/** Typed entry point for every app. Validated at load time and in CI (npm run validate). */
export function defineApp(def: AppInput): AppModule {
  const parsed = appSchema.parse(def);
  return { ...parsed, handlers: def.handlers };
}
