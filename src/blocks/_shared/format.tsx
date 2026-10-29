import type { SourceDef, Tone } from "@/connectors";
import type { Column, Format } from "./schema";

export interface ResolvedColumn { field: string; label: string; format: Format; pii: boolean; tones?: Record<string, Tone> }

export function resolveColumns(cols: Column[], def: SourceDef): ResolvedColumn[] {
  return cols.map((c) => {
    const field = typeof c === "string" ? c : c.field;
    const f = def.fields[field];
    const label = (typeof c !== "string" && c.label) || f?.label || field;
    const format = (typeof c !== "string" && c.format) || (f?.type as Format) || "text";
    return { field, label, format, pii: def.piiFields.includes(field), tones: f?.tones };
  });
}

/** Tone colours for badges (use with the `.badge` class). */
export const TONE_CLS: Record<Tone, string> = {
  neutral: "bg-slate-50 text-slate-600 ring-slate-500/20", info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", warn: "bg-amber-50 text-amber-800 ring-amber-600/25",
  bad: "bg-rose-50 text-rose-700 ring-rose-600/20", accent: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

const humanize = (v: string) => { const s = v.replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Generic workflow vocabulary only. Domain-specific values belong in the source's `fields[x].tones`. */
const DEFAULT_TONES: Record<string, Tone> = {
  pending: "warn", requested: "warn", open: "warn", pending_approval: "warn",
  in_review: "info", in_progress: "info",
  approved: "good", completed: "good", resolved: "good", active: "good",
  rejected: "bad", failed: "bad", cancelled: "bad",
  escalated: "accent", closed: "neutral",
};

export function StatusBadge({ value, tones }: { value: unknown; tones?: Record<string, Tone> }) {
  const v = String(value ?? "");
  if (!v) return <span className="text-slate-300">—</span>;
  const tone = tones?.[v] ?? DEFAULT_TONES[v] ?? "neutral";
  return <span className={`badge ${TONE_CLS[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{humanize(v)}</span>;
}

export const NUMERIC: Format[] = ["currency", "number", "percent"];

export function relative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatPlain(value: unknown, format: Format): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (format) {
    case "currency": return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
    case "number": return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "percent": return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    case "date": return new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    case "datetime": return new Date(String(value)).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    case "relative": return relative(String(value));
    case "boolean": return Number(value) ? "On" : "Off";
    default: return String(value);
  }
}

export function FormattedValue({ value, format, tones }: { value: unknown; format: Format; tones?: Record<string, Tone> }) {
  if (format === "status") return <StatusBadge value={value} tones={tones} />;
  if (format === "boolean") {
    const on = Number(value) === 1;
    return <span className={`badge ${TONE_CLS[on ? "good" : "neutral"]}`}>{on ? "On" : "Off"}</span>;
  }
  const text = formatPlain(value, format);
  if (text === "—") return <span className="text-slate-300">—</span>;
  return NUMERIC.includes(format) ? <span className="tabular-nums">{text}</span> : <>{text}</>;
}
