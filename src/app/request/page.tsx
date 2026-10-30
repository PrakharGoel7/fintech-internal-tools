import { listAppRequests } from "@/platform/requests";
import { getUser } from "@/platform";
import { RequestForm } from "./RequestForm";

export default function RequestPage() {
  const reqs = listAppRequests();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <h1 className="text-2xl font-semibold tracking-tight">Request an app</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">Describe the tool you need. An engineer approves Devin’s plan before anything is built.</p>
        <RequestForm />
      </div>
      <div className="lg:col-span-2">
        <h2 className="eyebrow mb-2">Recent requests</h2>
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={String(r.id)} className="card p-3 text-sm">
              <div className="font-medium">{String(r.title)}</div>
              <div className="text-xs text-slate-500">{getUser(String(r.requested_by)).name} · {String(r.status).replace(/_/g, " ")}</div>
              {typeof r.issue_url === "string" && <a className="link text-xs" href={r.issue_url}>GitHub issue ↗</a>}{" "}
              {typeof r.devin_session_url === "string" && <a className="link text-xs" href={r.devin_session_url}>Devin session ↗</a>}
            </div>
          ))}
          {reqs.length === 0 && <div className="text-sm text-slate-400">None yet</div>}
        </div>
      </div>
    </div>
  );
}
