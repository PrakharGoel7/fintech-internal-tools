import { listAudit, getUser } from "@/platform";
import { VerifyChain } from "./VerifyChain";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const entries = listAudit({ app: sp.app || undefined, actor: sp.actor || undefined, action: sp.action || undefined, limit: 300 });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-sm text-slate-500">Append-only and SHA-256 hash-chained across every app. PII values are never written here.</p>
        </div>
        <VerifyChain />
      </div>
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="app" defaultValue={sp.app} placeholder="app slug" className="rounded-md border border-slate-300 px-2 py-1.5" />
        <input name="actor" defaultValue={sp.actor} placeholder="actor id" className="rounded-md border border-slate-300 px-2 py-1.5" />
        <input name="action" defaultValue={sp.action} placeholder="action prefix (e.g. pii.)" className="rounded-md border border-slate-300 px-2 py-1.5" />
        <button className="rounded-md bg-slate-800 px-3 py-1.5 text-white">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
            <tr>{["#", "Time", "Actor", "App", "Action", "Record", "Reason", "Details", "Hash"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-3 py-2 text-slate-400">{e.id}</td>
                <td className="whitespace-nowrap px-3 py-2">{new Date(e.ts).toLocaleString()}</td>
                <td className="whitespace-nowrap px-3 py-2">{e.actor === "system" ? "system" : getUser(e.actor).name}</td>
                <td className="px-3 py-2">{e.app ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{e.action}</td>
                <td className="px-3 py-2 font-mono">{e.record_id ?? ""}</td>
                <td className="px-3 py-2">{e.reason ?? ""}</td>
                <td className="max-w-md px-3 py-2 font-mono text-[11px] text-slate-500">{JSON.stringify(e.details)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{e.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
