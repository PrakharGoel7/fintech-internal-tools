import Link from "next/link";
import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { actionMeta } from "../_shared/actions";
import { ActionButton } from "../_shared/ActionButton";
import { formatPlain } from "../_shared/format";

export function ToggleMatrix({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  const rows = source.list();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{title ?? `${source.def.label}s`}</div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">{source.def.fields[config.labelField]?.label ?? config.labelField}</th>
            {config.extraFields.map((f) => <th key={f} className="px-4 py-2 font-medium">{source.def.fields[f]?.label ?? f}</th>)}
            {config.columns.map((c) => <th key={c.field} className="px-4 py-2 text-center font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const id = String(r[source.def.pk]);
            return (
              <tr key={id}>
                <td className="px-4 py-2.5">
                  {config.rowLink
                    ? <Link href={`${ctx.basePath}/${config.rowLink.replace(":id", id)}`} className="font-mono text-sm font-medium text-indigo-600 hover:underline">{String(r[config.labelField])}</Link>
                    : <span className="font-mono text-sm font-medium">{String(r[config.labelField])}</span>}
                  {config.descriptionField && <div className="text-xs text-slate-500">{String(r[config.descriptionField])}</div>}
                </td>
                {config.extraFields.map((f) => <td key={f} className="px-4 py-2.5 text-slate-600">{formatPlain(r[f], source.def.fields[f]?.type === "number" ? "number" : "text")}</td>)}
                {config.columns.map((c) => {
                  const on = Number(r[c.field]) === 1;
                  const m = actionMeta(ctx, c.action, r);
                  const pill = (
                    <span className={`inline-flex w-14 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${on ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>{on ? "ON" : "OFF"}</span>
                  );
                  return (
                    <td key={c.field} className="px-4 py-2.5 text-center">
                      {m ? <ActionButton appSlug={ctx.app.slug} meta={{ ...m, label: `${on ? "Disable" : "Enable"} ${r[config.labelField]} in ${c.label}` }} recordId={id} size="xs">{pill}</ActionButton> : pill}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
