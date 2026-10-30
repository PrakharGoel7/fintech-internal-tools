import type { z } from "zod";
import { listAudit, getUser } from "@/platform";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { relative } from "../_shared/format";

export function AuditTimeline({ config, ctx, title }: BlockProps<z.input<typeof configSchema>>) {
  const recordId = config.scope === "record" ? ctx.params[config.idParam ?? "id"] : undefined;
  const entries = listAudit({ app: ctx.app.slug, source: config.scope === "record" ? config.source : undefined, recordId, limit: config.limit ?? 25 });
  return (
    <div className="card p-4">
      <h3 className="card-title mb-3">{title ?? "Activity"}</h3>
      <ol className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-2.5 text-sm">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-500 ring-4 ring-brand-50" />
            <div className="min-w-0">
              <div className="text-slate-800">
                <b className="font-medium">{e.actor === "system" ? "System" : getUser(e.actor).name}</b>{" "}
                <span className="chip">{e.action}</span>
                {config.scope !== "record" && e.record_id && <span className="font-mono text-xs text-slate-400"> · {e.record_id}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {relative(e.ts)}{e.reason && <> · reason: <b>{e.reason.replace(/_/g, " ")}</b></>}
                {typeof e.details.note === "string" && e.details.note && <> · “{e.details.note}”</>}
                {typeof e.details.checker === "string" && <> · approved by {e.details.checker}</>}
              </div>
            </div>
          </li>
        ))}
        {entries.length === 0 && <li className="text-sm text-slate-400">No activity yet</li>}
      </ol>
    </div>
  );
}
