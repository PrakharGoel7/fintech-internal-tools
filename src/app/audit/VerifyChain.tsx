"use client";
import { useState } from "react";
import { verifyAuditAction } from "../server-actions";

export function VerifyChain() {
  const [r, setR] = useState<{ ok: boolean; checked: number; brokenAt?: number } | null>(null);
  return (
    <div className="flex items-center gap-3">
      {r && (r.ok
        ? <span className="text-sm text-emerald-700">✓ Chain intact ({r.checked} entries)</span>
        : <span className="text-sm font-semibold text-rose-700">✗ Tampering detected at entry #{r.brokenAt}</span>)}
      <button onClick={async () => setR(await verifyAuditAction())} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Verify integrity</button>
    </div>
  );
}
