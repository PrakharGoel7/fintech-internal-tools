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
      <button disabled={busy} onClick={() => go("reject")} className="btn btn-sm btn-secondary">Reject</button>
      <button disabled={busy} onClick={() => go("approve")} className="btn btn-sm btn-success">Approve &amp; execute</button>
    </div>
  );
}
