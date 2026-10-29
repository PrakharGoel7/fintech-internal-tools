import Link from "next/link";
import type { z } from "zod";
import { getSource } from "@/connectors";
import { can, type Condition } from "@/platform";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { resolveColumns, FormattedValue } from "../_shared/format";
import { actionMeta } from "../_shared/actions";
import { ActionButton } from "../_shared/ActionButton";
import { GridToolbar } from "./GridToolbar";

export function gridQuery(config: z.infer<typeof configSchema>, search: Record<string, string>) {
  const where: Condition[] = [...(config.where ?? [])];
  for (const f of config.filters) {
    const v = search[`f_${f.field}`];
    if (v) where.push({ field: f.field, op: "eq", value: v });
  }
  return { where, search: config.searchable ? search.q : undefined };
}

export function DataGrid({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  const cols = resolveColumns(config.columns, source.def);
  const all = source.list(gridQuery(config, ctx.search));
  const rows = all.slice(0, config.pageSize);
  const canExport = config.exportable && can(ctx.user, ctx.app, "export");
  const exportHref = `/api/export?${new URLSearchParams({ ...ctx.search, app: ctx.app.slug, page: ctx.pageId, block: String(ctx.blockIndex) })}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title ?? `${source.def.label}s`} <span className="ml-1 font-normal text-slate-400">{all.length}</span></h3>
        <div className="flex items-center gap-2">
          <GridToolbar searchable={config.searchable} filters={config.filters.map((f) => ({ field: f.field, label: f.label ?? source.def.fields[f.field]?.label ?? f.field, options: f.options }))} />
          {canExport && <a href={exportHref} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Export CSV</a>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {cols.map((c) => <th key={c.field} className="px-4 py-2 font-medium">{c.label}</th>)}
              {config.rowActions.length > 0 && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const id = String(r[source.def.pk]);
              return (
                <tr key={id} className="hover:bg-slate-50/60">
                  {cols.map((c, i) => (
                    <td key={c.field} className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {i === 0 && config.rowLink ? (
                        <Link className="font-medium text-indigo-600 hover:underline" href={`${ctx.basePath}/${config.rowLink.replace(":id", encodeURIComponent(id))}`}>{String(r[c.field])}</Link>
                      ) : c.pii ? <span className="font-mono text-slate-500">{String(r[c.field])}</span> : <FormattedValue value={r[c.field]} format={c.format} />}
                    </td>
                  ))}
                  {config.rowActions.length > 0 && (
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        {config.rowActions.map((a) => {
                          const m = actionMeta(ctx, a, r);
                          return m ? <ActionButton key={a} appSlug={ctx.app.slug} meta={m} recordId={id} size="xs" /> : null;
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-4 py-8 text-center text-slate-400">No records</td></tr>}
          </tbody>
        </table>
      </div>
      {all.length > rows.length && <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Showing {rows.length} of {all.length}</div>}
    </div>
  );
}
