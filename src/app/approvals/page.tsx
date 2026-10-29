import { getCurrentUser } from "../session";
import { listApprovals, canDecide, getUser, approvalRules, maskValue } from "@/platform";
import { apps } from "@/apps/registry";
import { getSource } from "@/connectors";
import { relative, formatPlain } from "@/blocks/_shared/format";
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
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-slate-500">Maker-checker inbox shared by every app. Requesters can never approve their own requests.</p>
      </div>
      <div className="space-y-3">
        {pending.map((a) => {
          const app = apps.find((x) => x.slug === a.app)!;
          const src = getSource(a.source);
          const rec = a.record_id ? src.get(a.record_id) : null;
          const check = canDecide(user, a);
          const action = app.actions[a.action_id];
          const fields = action ? ruleFields(approvalRules(action).flatMap((r) => r.when)) : [];
          const show = (f: string, v: unknown) => src.def.piiFields.includes(f) ? maskValue(v) : formatPlain(v, (src.def.fields[f]?.type ?? "text") as Format);
          const label = (f: string) => src.def.fields[f]?.label ?? action?.inputs?.find((i) => i.field === f)?.label ?? f;
          return (
            <div key={a.id} className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm"><span className="font-semibold">{app.actions[a.action_id]?.label}</span> · {appName(a.app)} · <span className="font-mono text-xs">{a.record_id ?? "new record"}</span></div>
                  <div className="mt-1 text-xs text-slate-500">Requested by <b>{getUser(a.requested_by).name}</b> {relative(a.ts)} · reason <b>{a.reason?.replace(/_/g, " ") ?? "—"}</b>{a.note && <> · “{a.note}”</>}</div>
                  <div className="mt-1 text-xs text-orange-700">Rule: {a.rule} → needs {a.approver_roles.join(" / ")}</div>
                  {rec && <div className="mt-2 text-xs text-slate-600">{String(rec[src.def.titleField])}{fields.filter((f) => !(f in a.input)).map((f) => <span key={f}> · {label(f)} <b>{show(f, rec[f])}</b></span>)}</div>}
                  {Object.keys(a.input).length > 0 && <div className="mt-1 text-xs text-slate-600">{rec ? "Requested: " : "New record: "}{Object.entries(a.input).map(([f, v], i) => <span key={f}>{i > 0 && " · "}{label(f)} <b>{show(f, v)}</b></span>)}</div>}
                </div>
                {check.ok ? <DecideButtons approvalId={a.id} /> : <span className="text-xs text-slate-400">{check.why}</span>}
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">No pending approvals</div>}
      </div>
      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recently decided</h2>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {done.map((a) => (
              <div key={a.id} className="flex flex-wrap gap-x-4 px-4 py-2">
                <span className={a.status === "approved" ? "text-emerald-600" : "text-rose-600"}>{a.status}</span>
                <span>{appName(a.app)} · {a.action_id} · <span className="font-mono text-xs">{a.record_id}</span></span>
                <span className="text-slate-500">maker {a.requested_by} → checker {a.decided_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
