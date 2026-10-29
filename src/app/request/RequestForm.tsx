"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitAppRequestAction } from "../server-actions";
import { toast } from "@/components/Toaster";

const SENSITIVE = ["Customer PII", "Payment / card data", "Moves money", "Changes production config", "Regulatory reporting"];
const FIELDS: [string, string, string][] = [
  ["title", "App name", "e.g. Chargeback dispute queue"],
  ["team", "Your team", "e.g. Risk Ops"],
  ["users", "Who will use it?", "e.g. 6 risk analysts, 1 lead"],
  ["problem", "What problem does it solve? How is it done today?", "Today we track disputes in a spreadsheet…"],
  ["data", "What data does it need?", "Stripe disputes, customer profile, transaction history"],
  ["actions", "What do users do in it?", "Claim a dispute, upload evidence, accept or contest"],
  ["approvals", "Anything that needs a second approver?", "Accepting disputes over $1,000"],
];

export function RequestForm() {
  const [v, setV] = useState<Record<string, string>>({ urgency: "this quarter" });
  const [sens, setSens] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const router = useRouter();
  const cls = "mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
  return (
    <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={async (e) => {
      e.preventDefault();
      const r = await submitAppRequestAction({ title: v.title ?? "", team: v.team ?? "", users: v.users ?? "", problem: v.problem ?? "", data: v.data ?? "", actions: v.actions ?? "", approvals: v.approvals ?? "", sensitive: sens, urgency: v.urgency });
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) { setPrompt(r.prompt ?? null); router.refresh(); }
    }}>
      {FIELDS.map(([k, label, ph]) => (
        <label key={k} className="block text-sm font-medium text-slate-700">{label}
          {["problem", "actions", "data"].includes(k)
            ? <textarea rows={2} className={cls} placeholder={ph} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            : <input className={cls} placeholder={ph} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
        </label>
      ))}
      <fieldset className="text-sm"><legend className="font-medium text-slate-700">Sensitive data / risk</legend>
        <div className="mt-1 flex flex-wrap gap-3">{SENSITIVE.map((s) => (
          <label key={s} className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={sens.includes(s)} onChange={(e) => setSens(e.target.checked ? [...sens, s] : sens.filter((x) => x !== s))} />{s}</label>
        ))}</div>
      </fieldset>
      <label className="block text-sm font-medium text-slate-700">Urgency
        <select className={cls} value={v.urgency} onChange={(e) => setV({ ...v, urgency: e.target.value })}>{["this week", "this month", "this quarter"].map((o) => <option key={o}>{o}</option>)}</select>
      </label>
      <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Submit to Devin</button>
      {prompt && <div><div className="mt-3 text-xs font-semibold text-slate-600">Prompt sent to Devin</div><pre className="mt-1 whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs text-slate-100">{prompt}</pre></div>}
    </form>
  );
}
