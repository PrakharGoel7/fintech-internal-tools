"use client";
import { useState } from "react";
import { revealPiiAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";

export function PiiValue({ masked, canReveal, appSlug, source, recordId, field }: {
  masked: string; canReveal: boolean; appSlug: string; source: string; recordId: string; field: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  if (value !== null) return <span className="font-mono">{value} <span className="ml-1 rounded bg-amber-50 px-1 font-sans text-[10px] font-semibold tracking-wide text-amber-800 ring-1 ring-amber-600/25 ring-inset">REVEALED · AUDITED</span></span>;
  return (
    <span className="font-mono text-slate-500">
      {masked}
      {canReveal && (
        <button className="link ml-2 font-sans text-xs" onClick={async () => {
          const r = await revealPiiAction({ appSlug, source, recordId, field });
          if (r.ok) setValue(r.value!); else toast(r.message, "error");
        }}>reveal</button>
      )}
      <span className="ml-1 rounded bg-slate-100 px-1 font-sans text-[10px] font-semibold tracking-wide text-slate-500">PII</span>
    </span>
  );
}
