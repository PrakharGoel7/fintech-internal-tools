import Link from "next/link";
import type { z } from "zod";
import { getSource } from "@/connectors";
import { can } from "@/platform";
import type { BlockProps, BlockContext } from "../types";
import type { configSchema } from "./manifest";
import { resolveColumns, FormattedValue, type ResolvedColumn } from "../_shared/format";
import { actionMeta } from "../_shared/actions";
import { ActionButton } from "../_shared/ActionButton";
import { PiiValue } from "../_shared/PiiValue";

export function FieldList({ ctx, source, record, cols }: { ctx: BlockContext; source: string; record: Record<string, unknown>; cols: ResolvedColumn[] }) {
  const canReveal = can(ctx.user, ctx.app, "pii.reveal");
  const pk = getSource(source).def.pk;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {cols.map((c) => (
        <div key={c.field}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">
            {c.pii
              ? <PiiValue masked={String(record[c.field] ?? "")} canReveal={canReveal} appSlug={ctx.app.slug} source={source} recordId={String(record[pk])} field={c.field} />
              : <FormattedValue value={record[c.field]} format={c.format} tones={c.tones} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordDetail({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  const id = ctx.params[config.idParam];
  const record = id ? source.get(id) : null;
  if (!record) return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Record not found.</div>;
  const cols = resolveColumns(config.fields, source.def);
  const metas = config.actions.map((a) => actionMeta(ctx, a, record)).filter((m) => m !== null);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {config.backLink !== undefined && <Link href={`${ctx.basePath}/${config.backLink}`} className="text-xs text-indigo-600 hover:underline">← Back</Link>}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title ?? String(record[source.def.titleField])}</h3>
          <p className="font-mono text-xs text-slate-500">{source.def.label} · {id}</p>
        </div>
        <div className="flex gap-2">{metas.map((m) => <ActionButton key={m.id} appSlug={ctx.app.slug} meta={m} recordId={id} />)}</div>
      </div>
      <div className="mt-5"><FieldList ctx={ctx} source={config.source} record={record} cols={cols} /></div>
    </div>
  );
}
