import { getCurrentUser } from "../session";
import { listApprovals, canDecide, getUser } from "@/platform";
import { apps } from "@/apps/registry";
import { getSource } from "@/connectors";
import { relative, formatPlain, TONE_CLS } from "@/blocks/_shared/format";
import type { Format } from "@/blocks/_shared/schema";

/** Show the record fields the maker-checker rule is based on (e.g. amount, risk score). */
const ruleFields = (when?: { field: string }[]) => [...new Set((when ?? []).map((c) => c.field))];
import { DecideButtons } from "./DecideButtons";

export default async function Approvals() {
  const user = await getCurrentUser();
  const all = listApprovals();
  const pending = all.filter((a) => a.status === "pending");
  const done = all.filter((a) => a.status !== "pending").slice(0, 30);
  const appName = (s: string) => apps.find((a) => a.slug === s)?.name ?? s;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">Maker-checker inbox shared by every app. Requesters can never approve their own requests.</p>
      </div>
      <div className="space-y-3">
        {pending.map((a) => {
          const app = apps.find((x) => x.slug === a.app)!;
          const src = getSource(a.source);
          const rec = a.record_id ? src.get(a.record_id) : null;
          const check = canDecide(user, a);
          return (
            <div key={a.id} className="card border-l-4 border-l-amber-400 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm"><span className="font-semibold">{app.actions[a.action_id]?.label}</span> · {appName(a.app)} · <span className="chip">{a.record_id ?? "new record"}</span></div>
                  <div className="mt-1 text-xs text-slate-500">Requested by <b>{getUser(a.requested_by).name}</b> {relative(a.ts)} · reason <b>{a.reason?.replace(/_/g, " ") ?? "—"}</b>{a.note && <> · “{a.note}”</>}</div>
                  <div className="mt-1.5 text-xs font-medium text-amber-700">Rule: {a.rule} → needs {a.approver_roles.join(" / ")}</div>
                  {rec && <div className="mt-2 text-xs text-slate-600">{String(rec[src.def.titleField])}{ruleFields(app.actions[a.action_id]?.approval?.when).map((f) => <span key={f}> · {src.def.fields[f]?.label ?? f} <b>{formatPlain(rec[f], (src.def.fields[f]?.type ?? "text") as Format)}</b></span>)}</div>}
                  {!rec && Object.keys(a.input).length > 0 && <div className="mt-2 font-mono text-xs text-slate-600">{JSON.stringify(a.input)}</div>}
                </div>
                {check.ok ? <DecideButtons approvalId={a.id} /> : <span className="text-xs text-slate-400">{check.why}</span>}
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center text-sm text-slate-400">No pending approvals</div>}
      </div>
      {done.length > 0 && (
        <div>
          <h2 className="eyebrow mb-2">Recently decided</h2>
          <div className="card divide-y divide-slate-100 text-sm">
            {done.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-4 px-4 py-2.5">
                <span className={`badge ${TONE_CLS[a.status === "approved" ? "good" : "bad"]}`}>{a.status}</span>
                <span>{appName(a.app)} · {a.action_id} · <span className="chip">{a.record_id}</span></span>
                <span className="text-slate-500">maker {a.requested_by} → checker {a.decided_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
