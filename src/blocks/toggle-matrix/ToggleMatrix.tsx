import Link from "next/link";
import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { actionMeta } from "../_shared/actions";
import { ActionButton } from "../_shared/ActionButton";
import { resolveColumns, FormattedValue } from "../_shared/format";

export function ToggleMatrix({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  const rows = source.list();
  const extra = resolveColumns(config.extraFields, source.def);
  return (
    <div className="card overflow-hidden">
      <div className="card-title border-b border-slate-100 px-4 py-3">{title ?? `${source.def.label}s`}</div>
      <table className="min-w-full text-sm">
        <thead className="table-head border-b border-slate-100">
          <tr>
            <th className="px-4 py-2.5">{source.def.fields[config.labelField]?.label ?? config.labelField}</th>
            {config.extraFields.map((f) => <th key={f} className="px-4 py-2.5">{source.def.fields[f]?.label ?? f}</th>)}
            {config.columns.map((c) => <th key={c.field} className="px-4 py-2.5 text-center">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const id = String(r[source.def.pk]);
            return (
              <tr key={id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-2.5">
                  {config.rowLink
                    ? <Link href={`${ctx.basePath}/${config.rowLink.replace(":id", id)}`} className="link font-mono text-sm">{String(r[config.labelField])}</Link>
                    : <span className="font-mono text-sm font-medium">{String(r[config.labelField])}</span>}
                  {config.descriptionField && <div className="text-xs text-slate-500">{String(r[config.descriptionField])}</div>}
                </td>
                {extra.map((c) => <td key={c.field} className="px-4 py-2.5 text-slate-600"><FormattedValue value={r[c.field]} format={c.format} tones={c.tones} /></td>)}
                {config.columns.map((c) => {
                  const on = Number(r[c.field]) === 1;
                  const m = actionMeta(ctx, c.action, r);
                  const pill = (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className={`relative inline-flex h-5 w-9 flex-none rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                      </span>
                      <span className={`w-6 text-left ${on ? "text-emerald-700" : ""}`}>{on ? "On" : "Off"}</span>
                    </span>
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
