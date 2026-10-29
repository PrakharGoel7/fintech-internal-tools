"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { runActionAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";
import type { ActionMeta } from "./actions";

const VARIANT: Record<ActionMeta["variant"], string> = {
  default: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

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
  const pad = size === "xs" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  if (!meta.allowed) {
    return (
      <button disabled title={`You don't have permission to ${meta.label.toLowerCase()}`} className={`${pad} cursor-not-allowed rounded-md border border-dashed border-slate-300 text-slate-400`}>
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
      <button onClick={() => { setKey(crypto.randomUUID()); setOpen(true); }} className={`${pad} rounded-md font-medium shadow-sm ${children ? "" : VARIANT[meta.variant]}`}>
        {children ?? meta.label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">{meta.label}</h3>
            {recordId && <p className="mt-0.5 font-mono text-xs text-slate-500">{recordId}</p>}
            {meta.approvalRule && (
              <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800">
                <b>Maker-checker:</b> {meta.approvalRule}. This will be sent to <b>{meta.approverRoles.join(" / ")}</b> for approval before it executes.
              </div>
            )}
            {meta.reasonCodes.length > 0 && (
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Reason code <span className="text-rose-600">*</span>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">Select…</option>
                  {meta.reasonCodes.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </label>
            )}
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Note {meta.requireNote && <span className="text-rose-600">*</span>}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Context for the audit log" />
            </label>
            <p className="mt-3 text-xs text-slate-500">This action is recorded in the tamper-evident audit log.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={submit}
                disabled={busy || (meta.reasonCodes.length > 0 && !reason) || (meta.requireNote && !note.trim())}
                className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${VARIANT[meta.variant === "default" ? "primary" : meta.variant]}`}>
                {busy ? "Working…" : meta.approvalRule ? "Submit for approval" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
