"use client";
import { useState } from "react";
import { ActionButton } from "../_shared/ActionButton";
import type { ActionMeta } from "../_shared/actions";

type Field = { name: string; label: string; type: string; options?: string[]; required: boolean; placeholder?: string };

export function FormView({ appSlug, meta, fields, submitLabel }: { appSlug: string; meta: ActionMeta; fields: Field[]; submitLabel: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const missing = fields.some((f) => f.required && !values[f.name]?.trim());
  const input = Object.fromEntries(fields.map((f) => [f.name, f.type === "number" ? Number(values[f.name] ?? 0) : values[f.name] ?? ""]));
  const cls = "mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
  return (
    <div className="mt-4 space-y-3">
      {fields.map((f) => (
        <label key={f.name} className="block text-sm font-medium text-slate-700">
          {f.label} {f.required && <span className="text-rose-600">*</span>}
          {f.type === "textarea" ? (
            <textarea rows={3} className={cls} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          ) : f.type === "select" ? (
            <select className={cls} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
              <option value="">Select…</option>
              {f.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
            </select>
          ) : (
            <input type={f.type} className={cls} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          )}
        </label>
      ))}
      <div className={missing ? "pointer-events-none opacity-50" : ""}>
        <ActionButton appSlug={appSlug} meta={{ ...meta, label: submitLabel, variant: "primary" }} recordId={null} input={input} onDone={() => setValues({})} />
      </div>
    </div>
  );
}
