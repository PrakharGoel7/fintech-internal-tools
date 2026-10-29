"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideApprovalAction } from "../server-actions";
import { toast } from "@/components/Toaster";

export function DecideButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (decision: "approve" | "reject") => {
    setBusy(true);
    const r = await decideApprovalAction({ approvalId, decision });
    setBusy(false);
    toast(r.message, r.ok ? "success" : "error");
    router.refresh();
  };
  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={() => go("reject")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Reject</button>
      <button disabled={busy} onClick={() => go("approve")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Approve &amp; execute</button>
    </div>
  );
}
