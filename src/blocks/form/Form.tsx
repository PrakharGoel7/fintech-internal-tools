import type { z } from "zod";
import type { BlockProps } from "../types";
import type { configSchema } from "./manifest";
import { actionMeta } from "../_shared/actions";
import { FormView } from "./FormView";

export function Form({ config, ctx, title }: BlockProps<z.infer<typeof configSchema>>) {
  const meta = actionMeta(ctx, config.submitAction, null);
  if (!meta) return <div className="text-sm text-rose-600">Unknown action {config.submitAction}</div>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title ?? meta.label}</h3>
      {config.description && <p className="mt-1 text-xs text-slate-500">{config.description}</p>}
      <FormView appSlug={ctx.app.slug} meta={meta} fields={config.fields} submitLabel={config.submitLabel} />
    </div>
  );
}
