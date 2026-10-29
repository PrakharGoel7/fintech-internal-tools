import type { SourceDef } from "@/connectors";
import type { Column, Format } from "./schema";

export interface ResolvedColumn { field: string; label: string; format: Format; pii: boolean }

export function resolveColumns(cols: Column[], def: SourceDef): ResolvedColumn[] {
  return cols.map((c) => {
    const field = typeof c === "string" ? c : c.field;
    const f = def.fields[field];
    const label = (typeof c !== "string" && c.label) || f?.label || field;
    const format = (typeof c !== "string" && c.format) || (f?.type as Format) || "text";
    return { field, label, format, pii: def.piiFields.includes(field) };
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", requested: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800", needs_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800", issued: "bg-emerald-100 text-emerald-800", clear: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800", denied: "bg-rose-100 text-rose-800", watchlist_hit: "bg-rose-100 text-rose-800", failed: "bg-rose-100 text-rose-800",
  escalated: "bg-purple-100 text-purple-800", pending_approval: "bg-orange-100 text-orange-800",
  needs_response: "bg-amber-100 text-amber-800", under_review: "bg-blue-100 text-blue-800",
  won: "bg-emerald-100 text-emerald-800", lost: "bg-rose-100 text-rose-800", accepted: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ value }: { value: unknown }) {
  const v = String(value ?? "");
  if (!v) return <span className="text-slate-400">—</span>;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[v] ?? "bg-slate-100 text-slate-700"}`}>{v.replace(/_/g, " ")}</span>;
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

export function FormattedValue({ value, format }: { value: unknown; format: Format }) {
  if (format === "status") return <StatusBadge value={value} />;
  if (format === "boolean") {
    const on = Number(value) === 1;
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${on ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{on ? "ON" : "OFF"}</span>;
  }
  return <>{formatPlain(value, format)}</>;
}
