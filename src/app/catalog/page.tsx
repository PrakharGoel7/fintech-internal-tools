import fs from "node:fs";
import path from "node:path";
import { manifests } from "@/blocks/manifests";
import { sources } from "@/connectors";
import { externalConnectors } from "@/connectors/external";
import { apps } from "@/apps/registry";

const CAT_COLOR: Record<string, string> = { data: "bg-sky-50 text-sky-700 ring-sky-600/20", workflow: "bg-violet-50 text-violet-700 ring-violet-600/20", insight: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", input: "bg-amber-50 text-amber-800 ring-amber-600/25", collaboration: "bg-pink-50 text-pink-700 ring-pink-600/20", governance: "bg-rose-50 text-rose-700 ring-rose-600/20" };

export default function Catalog() {
  let gaps = "";
  try { gaps = fs.readFileSync(path.join(process.cwd(), "GAPS.md"), "utf8"); } catch {}
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Module catalog</h1>
        <p className="mt-1 text-sm text-slate-500">Building blocks Devin composes apps from.</p>
      </div>

      <section>
        <h2 className="eyebrow mb-2">Blocks</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Object.values(manifests).map((m) => {
            const usedBy = apps.filter((a) => a.pages.some((p) => p.blocks.some((b) => b.type === m.name))).map((a) => a.name);
            return (
              <div key={m.name} className="card p-4">
                <div className="flex items-center gap-2"><span className="font-mono font-semibold">{m.name}</span><span className={`badge px-1.5 text-[11px] ${CAT_COLOR[m.category]}`}>{m.category}</span></div>
                <p className="mt-1 text-sm text-slate-600">{m.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{usedBy.length ? <>Used by {usedBy.join(", ")}</> : "Not used by any app yet"}</p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-slate-500">Details</summary>
                  <div className="mt-2 space-y-2">
                    <div className="text-slate-400">v{m.version}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><div className="font-semibold text-emerald-700">Use when</div><ul className="list-disc pl-4 text-slate-600">{m.useWhen.map((x) => <li key={x}>{x}</li>)}</ul></div>
                      <div><div className="font-semibold text-rose-700">Not for</div><ul className="list-disc pl-4 text-slate-600">{m.notFor.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {m.requires.map((r) => <span key={r} className="rounded-md bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">requires {r}</span>)}
                      {m.emitsAudit.map((r) => <span key={r} className="chip">{r}</span>)}
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100">{JSON.stringify(m.example, null, 2)}</pre>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-2">Connectors</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Object.entries(sources).map(([name, s]) => (
            <div key={name} className="card p-4 text-sm">
              <div className="flex items-center gap-2"><span className="font-mono font-semibold">{name}</span>{s.def.piiFields.length > 0 && <span className="badge px-1.5 text-[11px] bg-rose-50 text-rose-700 ring-rose-600/20">PII</span>}</div>
              <div className="mt-0.5 text-xs text-slate-500">Data table</div>
              <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-500">Details</summary><div className="mt-1 text-slate-600">{Object.keys(s.def.fields).length} fields{s.def.piiFields.length > 0 && <> · PII: {s.def.piiFields.join(", ")}</>}</div></details>
            </div>
          ))}
          {Object.entries(externalConnectors).map(([name, ops]) => (
            <div key={name} className="card p-4 text-sm">
              <div className="font-mono font-semibold">{name}</div>
              <div className="mt-0.5 text-xs text-slate-500">External service (mocked)</div>
              <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-500">Details</summary><div className="mt-1 text-slate-600">Operations: {Object.keys(ops).join(", ")}</div></details>
            </div>
          ))}
        </div>
      </section>

      {gaps && <GapLedger md={gaps} />}
    </div>
  );
}


function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((t, i) => (t.startsWith("`") && t.endsWith("`") ? <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">{t.slice(1, -1)}</code> : t))}</>;
}

const GAP_STATUS: Record<string, { label: string; cls: string }> = {
  "app-local": { label: "Built for one app", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  resolved: { label: "Now a shared module", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
};

/** GAPS.md stays the source of truth; this view shows it in plain language. */
function GapLedger({ md }: { md: string }) {
  const rows = md.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .slice(1)
    .filter((r) => GAP_STATUS[r[3]?.match(/^[\w-]+/)?.[0] ?? ""]);
  return (
    <section>
      <h2 className="eyebrow mb-2">Gap ledger</h2>
      <div className="card overflow-hidden">
        <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">When an app needs something no module covers, Devin logs it here instead of quietly writing one-off code. Once a second app needs it, it becomes a shared module.</p>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          {Object.values(GAP_STATUS).map((s) => <span key={s.label} className={`badge ${s.cls}`}>{s.label}</span>)}
        </div>
        <table className="min-w-full text-sm">
          <thead className="table-head border-b border-slate-100 text-left"><tr><th className="px-4 py-2">Need</th><th className="px-4 py-2">Apps</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {rows.map(([need, apps, how, status]) => {
              const st = GAP_STATUS[status?.match(/^[\w-]+/)?.[0] ?? ""];
              return (
                <tr key={need}>
                  <td className="px-4 py-2.5"><div className="font-medium text-slate-800"><Inline text={need} /></div><div className="mt-0.5 text-xs text-slate-400"><Inline text={how ?? ""} /></div></td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{(apps ?? "").replace(/\s*\([^)]*\)/g, "")}</td>
                  <td className="px-4 py-2.5">{st ? <span className={`badge whitespace-nowrap ${st.cls}`}>{st.label}</span> : status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
