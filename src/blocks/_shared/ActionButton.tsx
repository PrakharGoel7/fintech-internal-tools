"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { runActionAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";
import type { ActionMeta } from "./actions";

const VARIANT: Record<ActionMeta["variant"], string> = { default: "btn-secondary", primary: "btn-primary", danger: "btn-danger" };

/** Guarded action: confirm dialog + reason code + note, routed through the platform action pipeline. */
export function ActionButton({ appSlug, meta, recordId, input, children, size = "sm", onDone }: {
  appSlug: string; meta: ActionMeta; recordId: string | null; input?: Record<string, unknown>;
  children?: ReactNode; size?: "xs" | "sm"; onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const pad = size === "xs" ? "btn-xs" : "btn-sm";

  if (!meta.allowed) {
    return (
      <button disabled data-action={meta.id} data-record={recordId ?? ""} title={`You don't have permission to ${meta.label.toLowerCase()}`} className={`btn ${pad} cursor-not-allowed border border-dashed border-slate-300 text-slate-400`}>
        {children ?? meta.label}
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    const res = await runActionAction({ appSlug, actionId: meta.id, recordId, reason: reason || null, note: note || null, input, idempotencyKey: key });
    setBusy(false);
    if (!res.ok) { toast(res.message, "error"); return; }
    toast(res.message, res.pending ? "info" : "success");
    setOpen(false); setReason(""); setNote("");
    onDone?.();
    router.refresh();
  }

  return (
    <>
      <button data-action={meta.id} data-record={recordId ?? ""} onClick={() => { setKey(crypto.randomUUID()); setOpen(true); }} className={children ? "rounded-full focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none" : `btn ${pad} ${VARIANT[meta.variant]}`}>
        {children ?? meta.label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-left whitespace-normal shadow-pop ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">{meta.label}</h3>
            {recordId && <p className="mt-1"><span className="chip">{recordId}</span></p>}
            {meta.approvalRule && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900">
                <b>Maker-checker:</b> {meta.approvalRule}. This will be sent to <b>{meta.approverRoles.join(" / ")}</b> for approval before it executes.
              </div>
            )}
            {meta.reasonCodes.length > 0 && (
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Reason code <span className="text-rose-600">*</span>
                <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1 block w-full">
                  <option value="">Select…</option>
                  {meta.reasonCodes.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </label>
            )}
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Note {meta.requireNote && <span className="text-rose-600">*</span>}
              <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input mt-1 block w-full" placeholder="Context for the audit log" />
            </label>
            <p className="mt-3 text-xs text-slate-500">This action is recorded in the tamper-evident audit log.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn btn-sm btn-secondary">Cancel</button>
              <button data-confirm onClick={submit}
                disabled={busy || (meta.reasonCodes.length > 0 && !reason) || (meta.requireNote && !note.trim())}
                className={`btn btn-sm ${VARIANT[meta.variant === "default" ? "primary" : meta.variant]}`}>
                {busy ? "Working…" : meta.approvalRule ? "Submit for approval" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
