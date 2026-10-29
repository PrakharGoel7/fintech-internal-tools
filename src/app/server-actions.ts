"use server";
import { cookies } from "next/headers";
import { getCurrentUser } from "./session";
import { getApp } from "@/apps/registry";
import { runAction, decideApproval, revealPii, addComment, verifyAuditChain, audit, getUser } from "@/platform";
import { submitAppRequest, type AppRequestInput } from "@/platform/requests";

type Result = { ok: boolean; message: string; pending?: boolean; value?: string };

function fail(e: unknown): Result {
  return { ok: false, message: e instanceof Error ? e.message : String(e) };
}

export async function runActionAction(args: {
  appSlug: string; actionId: string; recordId: string | null; reason: string | null; note: string | null;
  input?: Record<string, unknown>; idempotencyKey?: string;
}): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const app = getApp(args.appSlug);
    const res = await runAction({ user, app, actionId: args.actionId, recordId: args.recordId, reason: args.reason, note: args.note, input: args.input, idempotencyKey: args.idempotencyKey });
    const label = app.actions[args.actionId].label;
    return res.status === "pending_approval"
      ? { ok: true, pending: true, message: `Sent for approval: ${res.rule}` }
      : { ok: true, message: `${label} done (${res.recordId})` };
  } catch (e) { return fail(e); }
}

export async function decideApprovalAction(args: { approvalId: string; decision: "approve" | "reject"; note?: string }): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const r = await decideApproval({ user, ...args, getApp });
    return { ok: true, message: r.status === "approved" ? "Approved and executed" : "Rejected" };
  } catch (e) { return fail(e); }
}

export async function revealPiiAction(args: { appSlug: string; source: string; recordId: string; field: string }): Promise<Result> {
  try {
    const user = await getCurrentUser();
    return { ok: true, message: "revealed", value: revealPii({ user, app: getApp(args.appSlug), ...args }) };
  } catch (e) { return fail(e); }
}

export async function addCommentAction(args: { appSlug: string; source: string; recordId: string; body: string }): Promise<Result> {
  try {
    const user = await getCurrentUser();
    addComment({ user, app: getApp(args.appSlug), ...args });
    return { ok: true, message: "Posted" };
  } catch (e) { return fail(e); }
}

export async function switchUserAction(uid: string) {
  const c = await cookies();
  const user = getUser(uid);
  c.set("uid", user.id, { path: "/", sameSite: "lax" });
  audit({ actor: user.id, action: "auth.session_started", details: { method: "mock-sso" } });
}

export async function verifyAuditAction() {
  return verifyAuditChain();
}

export async function submitAppRequestAction(input: AppRequestInput): Promise<Result & { prompt?: string; issueUrl?: string | null; sessionUrl?: string | null }> {
  try {
    const user = await getCurrentUser();
    const r = await submitAppRequest(user, input);
    return { ok: true, message: r.message, prompt: r.prompt, issueUrl: r.issueUrl, sessionUrl: r.sessionUrl };
  } catch (e) { return fail(e); }
}
