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

export const TONE_CLS: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700", info: "bg-blue-100 text-blue-800", good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800", bad: "bg-rose-100 text-rose-800", accent: "bg-purple-100 text-purple-800",
};

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
  if (!v) return <span className="text-slate-400">—</span>;
  const tone = tones?.[v] ?? DEFAULT_TONES[v] ?? "neutral";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLS[tone]}`}>{v.replace(/_/g, " ")}</span>;
}

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
    case "percent": return `${Number(value)}%`;
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
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${on ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{on ? "ON" : "OFF"}</span>;
  }
  return <>{formatPlain(value, format)}</>;
}
