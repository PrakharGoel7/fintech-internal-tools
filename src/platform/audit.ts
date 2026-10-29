import crypto from "node:crypto";
import { getDb, type Row } from "./db";

export interface AuditEvent {
  actor: string;
  app?: string;
  action: string;
  source?: string;
  recordId?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string;
  app: string | null;
  action: string;
  source: string | null;
  record_id: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

const GENESIS = "0".repeat(64);

function computeHash(prev: string, e: Omit<AuditEntry, "id" | "hash" | "prev_hash">) {
  const payload = JSON.stringify([
    e.ts, e.actor, e.app, e.action, e.source, e.record_id, e.reason, e.details,
  ]);
  return crypto.createHash("sha256").update(prev + payload).digest("hex");
}

/** Append-only, hash-chained audit log. There is intentionally no update/delete API. */
export function audit(event: AuditEvent): AuditEntry {
  const db = getDb();
  const last = db.prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").get() as
    | { hash: string }
    | undefined;
  const prev = last?.hash ?? GENESIS;
  const entry = {
    ts: new Date().toISOString(),
    actor: event.actor,
    app: event.app ?? null,
    action: event.action,
    source: event.source ?? null,
    record_id: event.recordId ?? null,
    reason: event.reason ?? null,
    details: event.details ?? {},
  };
  const hash = computeHash(prev, entry);
  const res = db
    .prepare(
      `INSERT INTO audit_log (ts, actor, app, action, source, record_id, reason, details, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(entry.ts, entry.actor, entry.app, entry.action, entry.source, entry.record_id,
      entry.reason, JSON.stringify(entry.details), prev, hash);
  return { id: Number(res.lastInsertRowid), ...entry, prev_hash: prev, hash };
}

function parse(r: Row): AuditEntry {
  return { ...(r as unknown as AuditEntry), details: JSON.parse(String(r.details)) };
}

export function listAudit(filter: {
  app?: string; source?: string; recordId?: string; actor?: string; action?: string; limit?: number;
} = {}): AuditEntry[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.app) { where.push("app = ?"); args.push(filter.app); }
  if (filter.source) { where.push("source = ?"); args.push(filter.source); }
  if (filter.recordId) { where.push("record_id = ?"); args.push(filter.recordId); }
  if (filter.actor) { where.push("actor = ?"); args.push(filter.actor); }
  if (filter.action) { where.push("action LIKE ?"); args.push(`${filter.action}%`); }
  const sql = `SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY id DESC LIMIT ?`;
  args.push(filter.limit ?? 200);
  return (getDb().prepare(sql).all(...args) as Row[]).map(parse);
}

export function verifyAuditChain(): { ok: boolean; checked: number; brokenAt?: number } {
  const rows = (getDb().prepare("SELECT * FROM audit_log ORDER BY id ASC").all() as Row[]).map(parse);
  let prev = GENESIS;
  for (const r of rows) {
    const expected = computeHash(prev, r);
    if (r.prev_hash !== prev || r.hash !== expected) return { ok: false, checked: rows.length, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}
