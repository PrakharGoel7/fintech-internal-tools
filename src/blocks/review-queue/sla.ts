export interface SlaConfig { hours: number; mode: "elapsed" | "deadline" }

const fmt = (h: number) => (h >= 48 ? `${Math.floor(h / 24)}d` : `${Math.round(h)}h`);

/**
 * elapsed: the item is due `hours` after the timestamp (e.g. created_at + 72h).
 * deadline: the timestamp IS the due date (e.g. Stripe evidence_due_by); warn when fewer than `hours` remain.
 */
export function slaState(iso: string, sla: SlaConfig, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (sla.mode === "deadline") {
    const left = (t - now) / 3600000;
    if (left < 0) return { label: `Overdue ${fmt(-left)}`, cls: "bg-rose-50 text-rose-700 ring-rose-600/20" };
    if (left < sla.hours) return { label: `${fmt(left)} left`, cls: "bg-amber-50 text-amber-800 ring-amber-600/25" };
    return { label: `${fmt(left)} left`, cls: "bg-slate-50 text-slate-600 ring-slate-500/20" };
  }
  const left = sla.hours - (now - t) / 3600000;
  if (left < 0) return { label: `SLA breached ${Math.round(-left)}h`, cls: "bg-rose-50 text-rose-700 ring-rose-600/20" };
  if (left < sla.hours * 0.25) return { label: `${Math.round(left)}h left`, cls: "bg-amber-50 text-amber-800 ring-amber-600/25" };
  return { label: `${Math.round(left)}h left`, cls: "bg-slate-50 text-slate-600 ring-slate-500/20" };
}
