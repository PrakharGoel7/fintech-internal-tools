import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * L0 platform database. Only platform/ and connectors/ may import this module
 * (enforced by scripts/check-boundaries.ts).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  app TEXT,
  action TEXT NOT NULL,
  source TEXT,
  record_id TEXT,
  reason TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  app TEXT NOT NULL,
  action_id TEXT NOT NULL,
  source TEXT NOT NULL,
  record_id TEXT,
  input TEXT NOT NULL DEFAULT '{}',
  reason TEXT,
  note TEXT,
  rule TEXT,
  requested_by TEXT NOT NULL,
  approver_roles TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  decision_note TEXT
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  app TEXT NOT NULL,
  source TEXT NOT NULL,
  record_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  issue_url TEXT,
  devin_session_url TEXT
);
CREATE TABLE IF NOT EXISTS kyc_cases (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  ssn_last4 TEXT NOT NULL,
  dob TEXT NOT NULL,
  country TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  vendor_result TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  charge_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  stripe_refund_id TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  enabled_dev INTEGER NOT NULL,
  enabled_staging INTEGER NOT NULL,
  enabled_prod INTEGER NOT NULL,
  rollout_pct INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const g = globalThis as unknown as { __db?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__db) {
    const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db");
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(SCHEMA);
    g.__db = db;
  }
  return g.__db;
}

export function resetDbForTests() {
  g.__db?.close();
  g.__db = undefined;
}

export type Row = Record<string, unknown>;
