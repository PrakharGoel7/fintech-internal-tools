import fs from "node:fs";
import path from "node:path";
import { manifests } from "@/blocks/manifests";
import { apps } from "@/apps/registry";
import { sources } from "@/connectors";
import { externalConnectors } from "@/connectors/external";

const CAT_COLOR: Record<string, string> = { data: "bg-sky-100 text-sky-700", workflow: "bg-violet-100 text-violet-700", insight: "bg-emerald-100 text-emerald-700", input: "bg-amber-100 text-amber-700", collaboration: "bg-pink-100 text-pink-700", governance: "bg-rose-100 text-rose-700" };

export default function Catalog() {
  const usage = (name: string) => apps.filter((a) => a.pages.some((p) => p.blocks.some((b) => b.type === name)));
  let gaps = "";
  try { gaps = fs.readFileSync(path.join(process.cwd(), "GAPS.md"), "utf8"); } catch {}
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Module catalog</h1>
        <p className="text-sm text-slate-500">What Devin reads (as <code>catalog.json</code>) before composing an app. Every block has a typed config schema, use-when / not-for guidance, and declared guarantees.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Reuse matrix</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Block</th>{apps.map((a) => <th key={a.slug} className="px-3 py-2">{a.name}</th>)}<th className="px-3 py-2">Apps</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(manifests).map((m) => (
                <tr key={m.name}><td className="px-3 py-1.5 font-mono text-xs">{m.name}</td>{apps.map((a) => <td key={a.slug} className="px-3 py-1.5 text-center">{usage(m.name).includes(a) ? "●" : ""}</td>)}<td className="px-3 py-1.5 text-center font-semibold">{usage(m.name).length}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Blocks (L3)</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Object.values(manifests).map((m) => (
            <div key={m.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2"><span className="font-mono font-semibold">{m.name}</span><span className="text-xs text-slate-400">v{m.version}</span><span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CAT_COLOR[m.category]}`}>{m.category}</span></div>
              <p className="mt-1 text-sm text-slate-600">{m.summary}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div><div className="font-semibold text-emerald-700">Use when</div><ul className="list-disc pl-4 text-slate-600">{m.useWhen.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><div className="font-semibold text-rose-700">Not for</div><ul className="list-disc pl-4 text-slate-600">{m.notFor.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                {m.requires.map((r) => <span key={r} className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">requires {r}</span>)}
                {m.emitsAudit.map((r) => <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{r}</span>)}
              </div>
              <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-500">Example config</summary><pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-slate-100">{JSON.stringify(m.example, null, 2)}</pre></details>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Connectors (L2)</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Object.entries(sources).map(([name, s]) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div className="font-mono font-semibold">{name}</div>
              <div className="text-xs text-slate-500">table source · {Object.keys(s.def.fields).length} fields</div>
              <div className="mt-1 text-xs">PII: {s.def.piiFields.length ? s.def.piiFields.map((f) => <span key={f} className="mr-1 rounded bg-rose-50 px-1 font-mono text-rose-700">{f}</span>) : "none"}</div>
            </div>
          ))}
          {Object.entries(externalConnectors).map(([name, ops]) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div className="font-mono font-semibold">{name}</div>
              <div className="text-xs text-slate-500">external (mocked) · ops: {Object.keys(ops).join(", ")}</div>
            </div>
          ))}
        </div>
      </section>

      {gaps && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Gap ledger (GAPS.md)</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{gaps}</pre>
        </section>
      )}
    </div>
  );
}
