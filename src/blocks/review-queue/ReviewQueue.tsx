import Link from "next/link";
import type { z } from "zod";
import { getSource } from "@/connectors";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { resolveColumns, FormattedValue, StatusBadge, TONE_CLS, relative, formatPlain } from "../_shared/format";
import { matches } from "@/platform";
import { slaState } from "./sla";
import { actionMeta } from "../_shared/actions";
import { ActionButton } from "../_shared/ActionButton";
import { FieldList } from "../record-detail/RecordDetail";
import { Comments } from "../comments/Comments";
import { AuditTimeline } from "../audit-timeline/AuditTimeline";

export function ReviewQueue({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const source = getSource(config.source);
  const mine = ctx.search.mine === "1";
  let items = source.list({ where: config.openWhere });
  if (mine) items = items.filter((r) => r[config.assigneeField] === ctx.user.id);
  const selectedId = ctx.search.item ?? (items[0] ? String(items[0][source.def.pk]) : undefined);
  const selected = selectedId ? source.get(selectedId) : null;
  const summary = resolveColumns(config.summaryFields, source.def);
  const detail = resolveColumns(config.detailFields, source.def);
  const href = (p: Record<string, string>) => `${ctx.pathname}?${new URLSearchParams({ ...ctx.search, ...p })}`;
  const assignee = selected?.[config.assigneeField] as string | null | undefined;
  const claim = config.claimAction && selected ? actionMeta(ctx, config.claimAction, selected) : null;
  const decisions = selected ? config.decisionActions.map((a) => actionMeta(ctx, a, selected)).filter((m) => m !== null) : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title ?? "Queue"} <span className="font-normal text-slate-400">{items.length}</span></h3>
          <div className="flex rounded-md border border-slate-200 text-xs">
            <Link href={href({ mine: "", item: "" })} className={`px-2 py-1 ${!mine ? "bg-slate-100 font-medium" : ""}`}>All</Link>
            <Link href={href({ mine: "1", item: "" })} className={`px-2 py-1 ${mine ? "bg-slate-100 font-medium" : ""}`}>Mine</Link>
          </div>
        </div>
        <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
          {items.map((r) => {
            const id = String(r[source.def.pk]);
            const sla = config.sla ? slaState(String(r[config.sla.field]), config.sla) : null;
            const badges = config.badges.filter((b) => matches(b.when, r));
            return (
              <li key={id}>
                <Link href={href({ item: id })} className={`block px-4 py-2.5 hover:bg-slate-50 ${id === selectedId ? "bg-indigo-50/70" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">{id}</span>
                    <div className="flex gap-1">
                      {badges.map((b) => <span key={b.label} className={`rounded-full px-1.5 text-[10px] font-semibold uppercase ${TONE_CLS[b.tone]}`}>{b.label}</span>)}
                      {sla && <span className={`rounded-full px-1.5 text-[10px] font-medium ${sla.cls}`}>{sla.label}</span>}
                    </div>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-slate-700">
                    {summary.map((c) => <span key={c.field}><FormattedValue value={r[c.field]} format={c.format} tones={c.tones} /></span>)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{r[config.assigneeField] ? `Assigned to ${r[config.assigneeField]}` : "Unassigned"}</div>
                </Link>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">Queue is empty 🎉</li>}
        </ul>
      </div>

      <div className="space-y-4">
        {selected ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{String(selected[source.def.titleField])}</h3>
                  <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-500">
                    {selectedId} <StatusBadge value={selected[config.statusField]} tones={source.def.fields[config.statusField]?.tones} />
                    {config.sla && config.sla.mode === "elapsed" && <span className="font-sans">submitted {relative(String(selected[config.sla.field]))}</span>}
                    {config.sla && config.sla.mode === "deadline" && <span className="font-sans">due {formatPlain(selected[config.sla.field], "datetime")} ({slaState(String(selected[config.sla.field]), config.sla).label})</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {claim && assignee !== ctx.user.id && <ActionButton appSlug={ctx.app.slug} meta={claim} recordId={selectedId!} />}
                  {decisions.map((m) => <ActionButton key={m.id} appSlug={ctx.app.slug} meta={m} recordId={selectedId!} />)}
                </div>
              </div>
              <div className="mt-5"><FieldList ctx={ctx} source={config.source} record={selected} cols={detail} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {config.comments && <Comments config={{ source: config.source, idParam: "item" }} ctx={{ ...ctx, params: { ...ctx.params, item: selectedId! } }} />}
              {config.history && <AuditTimeline config={{ scope: "record", source: config.source, idParam: "item", limit: 20 }} ctx={{ ...ctx, params: { ...ctx.params, item: selectedId! } }} title="Case history" />}
            </div>
          </>
        ) : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">Select an item</div>}
      </div>
    </div>
  );
}
