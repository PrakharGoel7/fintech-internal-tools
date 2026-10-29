"use client";
import { useState } from "react";
import { revealPiiAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";

export function PiiValue({ masked, canReveal, appSlug, source, recordId, field }: {
  masked: string; canReveal: boolean; appSlug: string; source: string; recordId: string; field: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  if (value !== null) return <span className="font-mono">{value} <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">REVEALED · AUDITED</span></span>;
  return (
    <span className="font-mono text-slate-600">
      {masked}
      {canReveal && (
        <button className="ml-2 text-xs font-medium text-indigo-600 hover:underline" onClick={async () => {
          const r = await revealPiiAction({ appSlug, source, recordId, field });
          if (r.ok) setValue(r.value!); else toast(r.message, "error");
        }}>reveal</button>
      )}
      <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">PII</span>
    </span>
  );
}
