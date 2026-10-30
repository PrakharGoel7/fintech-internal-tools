import Link from "next/link";
import { getCurrentUser } from "../session";
import { getUser } from "@/platform";
import { getAppRequests, loadRequestState, canReviewRequests, STAGES, REQUEST_REVIEW_ROLES } from "@/platform/requests";
import { relative, TONE_CLS } from "@/blocks/_shared/format";

export default async function RequestsDashboard() {
  const user = await getCurrentUser();
  if (!canReviewRequests(user)) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700"><b>Access denied.</b> The Requests dashboard is for {REQUEST_REVIEW_ROLES.join(" / ")}.</div>;
  }
  const rows = await Promise.all(getAppRequests().map(async (r) => ({ r, s: await loadRequestState(r) })));
  const waiting = rows.filter(({ s }) => STAGES[s.stage].waitingOn === "engineer").length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App requests</h1>
        <p className="mt-1 text-sm text-slate-500">Approve Devin&apos;s plan before it builds. Watch the test videos before it ships.</p>
      </div>
      <div className="flex gap-3 text-sm">
        <span className={`badge ${TONE_CLS.warn}`}>{waiting} waiting on an engineer</span>
        <span className={`badge ${TONE_CLS.neutral}`}>{rows.length} total</span>
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="table-head border-b border-slate-100 text-left">
            <tr><th className="px-4 py-2">Request</th><th className="px-4 py-2">Requested by</th><th className="px-4 py-2">Submitted</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Waiting on</th><th className="px-4 py-2">PR</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ r, s }) => {
              const st = STAGES[s.stage];
              const by = getUser(r.requestedBy);
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5"><Link className="link font-medium" href={`/requests/${r.id}`}>{r.title}</Link><div className="text-xs text-slate-500">{r.input.team}</div></td>
                  <td className="px-4 py-2.5 text-slate-600">{by.name}<div className="text-xs text-slate-400">{by.title}</div></td>
                  <td className="px-4 py-2.5 text-slate-600">{relative(r.ts)}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${TONE_CLS[st.tone]}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-slate-600">{st.waitingOn === "engineer" ? <b className="text-amber-700">You</b> : st.waitingOn === "devin" ? "Devin" : "—"}</td>
                  <td className="px-4 py-2.5">{s.pull ? <a className="link" href={s.pull.url}>#{s.pull.number} ↗</a> : <span className="text-slate-400">—</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No requests yet</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.some(({ s }) => s.error) && <p className="text-xs text-rose-600">{rows.find(({ s }) => s.error)!.s.error}</p>}
    </div>
  );
}
