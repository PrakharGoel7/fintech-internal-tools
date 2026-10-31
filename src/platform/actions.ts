import crypto from "node:crypto";
import { getDb, type Row } from "./db";
import { audit } from "./audit";
import { assertCan, ForbiddenError } from "./rbac";
import { matches, describeConditions } from "./conditions";
import { maskRow } from "./pii";
import type { AppModule, ActionDef, Effect } from "./app-definition";
import type { User } from "./users";
import { getSource, externalConnectors } from "@/connectors";

class ActionError extends Error {
  constructor(msg: string) { super(msg); this.name = "ActionError"; }
}

export type ActionResult =
  | { status: "executed"; recordId: string }
  | { status: "pending_approval"; approvalId: string; rule: string };

export interface RunActionInput {
  user: User;
  app: AppModule;
  actionId: string;
  recordId?: string | null;
  reason?: string | null;
  note?: string | null;
  input?: Row;
  idempotencyKey?: string;
}

function resolveTokens(set: Row, user: User): Row {
  const now = new Date().toISOString();
  return Object.fromEntries(
    Object.entries(set).map(([k, v]) => [k, v === "$user" ? user.id : v === "$now" ? now : v]),
  );
}

function diff(before: Row | null, after: Row, pii: string[]): Row {
  const changed: Row = {};
  for (const k of Object.keys(after)) {
    if (k === "updated_at") continue;
    if (!before || before[k] !== after[k]) {
      changed[k] = pii.includes(k)
        ? { from: "[pii]", to: "[pii]" }
        : { from: before ? before[k] ?? null : null, to: after[k] ?? null };
    }
  }
  return changed;
}

async function executeEffect(app: AppModule, action: ActionDef, effect: Effect, recordId: string | null, input: Row, user: User) {
  const source = getSource(action.source);
  const before = recordId ? source.getRaw(recordId) : null;
  if (recordId && !before) throw new ActionError(`Record ${recordId} not found`);
  let patch: Row;
  switch (effect.kind) {
    case "update": patch = resolveTokens(effect.set, user); break;
    case "toggle": patch = { [effect.field]: Number(before?.[effect.field]) ? 0 : 1 }; break;
    case "connector": {
      const op = externalConnectors[effect.connector]?.[effect.op];
      if (!op) throw new ActionError(`Unknown connector op ${effect.connector}.${effect.op}`);
      patch = await op(before, input);
      break;
    }
    case "handler": {
      const h = app.handlers?.[effect.name];
      if (!h) throw new ActionError(`Unknown handler ${effect.name} in ${app.slug}`);
      patch = await h({ record: before, input, user });
      break;
    }
    case "create": {
      const now = new Date().toISOString();
      const id = `${source.def.label.slice(0, 3).toLowerCase()}_${crypto.randomBytes(4).toString("hex")}`;
      const created = source.create({
        [source.def.pk]: id, ...resolveTokens(effect.defaults, user), ...input, created_at: now, updated_at: now,
      });
      return { recordId: String(created[source.def.pk]), before: null, after: created };
    }
  }
  const after = source.update(recordId!, { ...patch, updated_at: new Date().toISOString() });
  return { recordId: recordId!, before, after };
}

function assertSeparated(action: ActionDef, record: Row | null, user: User) {
  const field = record && action.notBy?.find((f) => record[f] === user.id);
  if (!field) return;
  const label = getSource(action.source).def.fields[field]?.label ?? field;
  throw new ActionError(`"${action.label}" needs someone other than this record's ${label} (segregation of duties)`);
}

/**
 * The single mutation pipeline for every app:
 * RBAC → reason code → availability guard → idempotency → maker-checker → segregation of duties → execute → audit.
 */
export async function runAction(req: RunActionInput): Promise<ActionResult> {
  const { user, app, actionId } = req;
  const action = app.actions[actionId];
  if (!action) throw new ActionError(`Unknown action ${actionId}`);
  assertCan(user, app, action.permission);
  if (action.reasonCodes?.length && !action.reasonCodes.includes(req.reason ?? "")) {
    throw new ActionError(`A reason code is required (${action.reasonCodes.join(", ")})`);
  }
  if (action.requireNote && !req.note?.trim()) throw new ActionError("A note is required");

  const db = getDb();
  if (req.idempotencyKey) {
    const prior = db.prepare("SELECT result FROM idempotency WHERE key = ?").get(req.idempotencyKey) as { result: string } | undefined;
    if (prior) return JSON.parse(prior.result);
  }

  const source = getSource(action.source);
  const recordId = req.recordId ?? null;
  const record = recordId ? source.getRaw(recordId) : null;
  if (recordId && !record) throw new ActionError(`Record ${recordId} not found`);
  if (record && !matches(action.availableWhen, record)) {
    throw new ActionError(`"${action.label}" is not available for this record (${describeConditions(action.availableWhen)})`);
  }
  const input = req.input ?? {};
  const subject = { ...(record ?? {}), ...input };

  let result: ActionResult;
  if (action.approval && matches(action.approval.when, subject)) {
    const approvalId = `apr_${crypto.randomBytes(5).toString("hex")}`;
    const rule = action.approval.description ?? describeConditions(action.approval.when);
    db.prepare(
      `INSERT INTO approvals (id, ts, app, action_id, source, record_id, input, reason, note, rule, requested_by, approver_roles, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).run(approvalId, new Date().toISOString(), app.slug, actionId, action.source, recordId,
      JSON.stringify(input), req.reason ?? null, req.note ?? null, rule, user.id, JSON.stringify(action.approval.approverRoles));
    audit({
      actor: user.id, app: app.slug, action: "approval.requested", source: action.source, recordId,
      reason: req.reason, details: { approvalId, action: actionId, rule, note: req.note ?? null, input: maskRow(input, source.def.piiFields) },
    });
    result = { status: "pending_approval", approvalId, rule };
  } else {
    assertSeparated(action, record, user);
    const out = await executeEffect(app, action, action.effect, recordId, input, user);
    audit({
      actor: user.id, app: app.slug, action: `action.${actionId}`, source: action.source, recordId: out.recordId,
      reason: req.reason, details: { label: action.label, note: req.note ?? null, changes: diff(out.before, out.after, source.def.piiFields) },
    });
    result = { status: "executed", recordId: out.recordId };
  }
  if (req.idempotencyKey) {
    db.prepare("INSERT INTO idempotency (key, ts, result) VALUES (?, ?, ?)").run(req.idempotencyKey, new Date().toISOString(), JSON.stringify(result));
  }
  return result;
}

export interface Approval {
  id: string; ts: string; app: string; action_id: string; source: string; record_id: string | null;
  input: Row; reason: string | null; note: string | null; rule: string; requested_by: string;
  approver_roles: string[]; status: "pending" | "approved" | "rejected" | "failed";
  decided_by: string | null; decided_at: string | null; decision_note: string | null;
}

function parseApproval(r: Row): Approval {
  return { ...(r as unknown as Approval), input: JSON.parse(String(r.input)), approver_roles: JSON.parse(String(r.approver_roles)) };
}

export function listApprovals(filter: { status?: string; app?: string } = {}): Approval[] {
  const where: string[] = []; const args: string[] = [];
  if (filter.status) { where.push("status = ?"); args.push(filter.status); }
  if (filter.app) { where.push("app = ?"); args.push(filter.app); }
  return (getDb().prepare(`SELECT * FROM approvals ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ts DESC`).all(...args) as Row[]).map(parseApproval);
}

export function canDecide(user: User, a: Approval): { ok: boolean; why?: string } {
  if (a.status !== "pending") return { ok: false, why: "Already decided" };
  if (a.requested_by === user.id) return { ok: false, why: "Maker-checker: you cannot approve your own request" };
  if (!user.roles.some((r) => a.approver_roles.includes(r))) return { ok: false, why: `Requires role: ${a.approver_roles.join(" / ")}` };
  return { ok: true };
}

export async function decideApproval(opts: {
  user: User; approvalId: string; decision: "approve" | "reject"; note?: string; getApp: (slug: string) => AppModule;
}) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(opts.approvalId) as Row | undefined;
  if (!row) throw new ActionError("Approval not found");
  const a = parseApproval(row);
  const check = canDecide(opts.user, a);
  if (!check.ok) throw new ForbiddenError(check.why!);
  const now = new Date().toISOString();
  if (opts.decision === "reject") {
    db.prepare("UPDATE approvals SET status='rejected', decided_by=?, decided_at=?, decision_note=? WHERE id=?").run(opts.user.id, now, opts.note ?? null, a.id);
    audit({ actor: opts.user.id, app: a.app, action: "approval.rejected", source: a.source, recordId: a.record_id, details: { approvalId: a.id, requestedBy: a.requested_by, note: opts.note ?? null } });
    return { status: "rejected" as const };
  }
  const app = opts.getApp(a.app);
  const action = app.actions[a.action_id];
  const record = a.record_id ? getSource(a.source).getRaw(a.record_id) : null;
  if (record && !matches(action.availableWhen, record)) {
    db.prepare("UPDATE approvals SET status='failed', decided_by=?, decided_at=?, decision_note=? WHERE id=?").run(opts.user.id, now, "Record changed; action no longer applicable", a.id);
    throw new ActionError("Record changed since the request; action is no longer applicable");
  }
  assertSeparated(action, record, opts.user);
  const out = await executeEffect(app, action, action.effect, a.record_id, a.input, opts.user);
  db.prepare("UPDATE approvals SET status='approved', decided_by=?, decided_at=?, decision_note=? WHERE id=?").run(opts.user.id, now, opts.note ?? null, a.id);
  audit({
    actor: opts.user.id, app: a.app, action: `action.${a.action_id}`, source: a.source, recordId: out.recordId, reason: a.reason,
    details: { label: action.label, approvalId: a.id, maker: a.requested_by, checker: opts.user.id, changes: diff(out.before, out.after, getSource(a.source).def.piiFields) },
  });
  return { status: "approved" as const, recordId: out.recordId };
}

export function revealPii(opts: { user: User; app: AppModule; source: string; recordId: string; field: string }) {
  assertCan(opts.user, opts.app, "pii.reveal");
  const src = getSource(opts.source);
  if (!src.def.piiFields.includes(opts.field)) throw new ActionError("Not a PII field");
  const rec = src.getRaw(opts.recordId);
  if (!rec) throw new ActionError("Record not found");
  audit({ actor: opts.user.id, app: opts.app.slug, action: "pii.revealed", source: opts.source, recordId: opts.recordId, details: { field: opts.field } });
  return String(rec[opts.field] ?? "");
}

export function listComments(app: string, source: string, recordId: string) {
  return getDb().prepare("SELECT * FROM comments WHERE app=? AND source=? AND record_id=? ORDER BY id ASC").all(app, source, recordId) as Row[];
}

export function addComment(opts: { user: User; app: AppModule; source: string; recordId: string; body: string }) {
  assertCan(opts.user, opts.app, "comment");
  if (!opts.body.trim()) throw new ActionError("Empty comment");
  getDb().prepare("INSERT INTO comments (ts, app, source, record_id, author, body) VALUES (?, ?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), opts.app.slug, opts.source, opts.recordId, opts.user.id, opts.body.trim());
  audit({ actor: opts.user.id, app: opts.app.slug, action: "comment.added", source: opts.source, recordId: opts.recordId, details: { length: opts.body.length } });
}
