import { getSource } from "@/connectors";
import { listAudit } from "./audit";
import type { JourneyStep } from "./scenarios";

type Values = Record<string, unknown>;

/** `"$now-2h"` / `"$now+3d"` → timestamps; `"$unique"` inside a string → a per-run token (for keys that must be unique). */
export function resolveValue(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = v.match(/^\$now(?:([+-]\d+)([hd]))?$/);
  if (m) return new Date(Date.now() + (m[1] ? Number(m[1]) * (m[2] === "d" ? 86400000 : 3600000) : 0)).toISOString();
  return v.includes("$unique") ? v.replace(/\$unique/g, RUN) : v;
}
const RUN = Date.now().toString(36);
export const resolveValues = (vals: Values = {}) => Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, resolveValue(v)]));

let seq = 0;
/** Inserts a fresh record: listed fields from `given`, neutral defaults for the rest. Returns its id. */
export function makeRecord(sourceName: string, given?: Values): string {
  const src = getSource(sourceName);
  const now = new Date().toISOString();
  const row: Values = {};
  for (const [k, f] of Object.entries(src.def.fields)) {
    row[k] = ["number", "currency", "boolean"].includes(f.type) ? 0 : f.type === "date" ? now : f.type === "status" ? null : `${f.label ?? k} ${seq + 1}`;
  }
  row[src.def.pk] = `scn_${RUN}_${++seq}`;
  Object.assign(row, resolveValues(given));
  return String(src.create(row)[src.def.pk]);
}

/** The audit entries a journey's steps should leave on its record, in order: "<actor> <action>". */
export function expectedTrail(steps: JourneyStep[]): string[] {
  const out: string[] = [];
  let pending: string | null = null;
  for (const s of steps) {
    if ("approve" in s) { out.push(`${s.as} action.${pending}`); pending = null; }
    else if ("reject" in s) { out.push(`${s.as} approval.rejected`); pending = null; }
    else if (s.expect === "waits") { out.push(`${s.as} approval.requested`); pending = s.do; }
    else if (s.expect !== "blocked") out.push(`${s.as} action.${s.do}`);
  }
  return out;
}

/** The record's actual trail (oldest first), ignoring reads such as PII reveals and comments. */
export function actualTrail(source: string, recordId: string): string[] {
  return listAudit({ source, recordId, limit: 1000 }).reverse()
    .filter((e) => e.action.startsWith("action.") || e.action.startsWith("approval."))
    .map((e) => `${e.actor} ${e.action}`);
}
