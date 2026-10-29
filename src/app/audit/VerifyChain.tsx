"use client";
import { useState } from "react";
import { verifyAuditAction } from "../server-actions";

export function VerifyChain() {
  const [r, setR] = useState<{ ok: boolean; checked: number; brokenAt?: number } | null>(null);
  return (
    <div className="flex items-center gap-3">
      {r && (r.ok
        ? <span className="badge bg-emerald-50 text-sm text-emerald-700 ring-emerald-600/20">✓ Chain intact ({r.checked} entries)</span>
        : <span className="badge bg-rose-50 text-sm font-semibold text-rose-700 ring-rose-600/20">✗ Tampering detected at entry #{r.brokenAt}</span>)}
      <button onClick={async () => setR(await verifyAuditAction())} className="btn btn-sm btn-secondary">Verify integrity</button>
    </div>
  );
}
