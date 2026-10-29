import type { z } from "zod";
import { listComments, getUser, can } from "@/platform";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { relative } from "../_shared/format";
import { CommentBox } from "./CommentBox";

export function Comments({ config, ctx, title }: BlockProps<z.input<typeof configSchema>>) {
  const recordId = ctx.params[config.idParam ?? "id"];
  const items = listComments(ctx.app.slug, config.source, recordId);
  return (
    <div className="card p-4">
      <h3 className="card-title mb-3">{title ?? "Notes"}</h3>
      <ul className="space-y-2.5">
        {items.map((c) => (
          <li key={String(c.id)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/60 ring-inset">
            <div className="text-xs text-slate-500"><b className="text-slate-700">{getUser(String(c.author)).name}</b> · {relative(String(c.ts))}</div>
            <div className="mt-0.5 whitespace-pre-wrap text-slate-800">{String(c.body)}</div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-400">No notes yet</li>}
      </ul>
      {can(ctx.user, ctx.app, "comment") && <CommentBox appSlug={ctx.app.slug} source={config.source} recordId={recordId} />}
    </div>
  );
}
