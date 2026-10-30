"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideSpecAction, shipRequestAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";

export function SpecReview({ id }: { id: number }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (decision: "approved" | "changes_requested") => {
    setBusy(true);
    const r = await decideSpecAction({ id, decision, comment });
    setBusy(false);
    toast(r.message, r.ok ? "success" : "error");
    if (r.ok) { setComment(""); router.refresh(); }
  };
  return (
    <div className="space-y-2">
      <textarea name="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="input block w-full" placeholder="Comment for Devin (required to request changes)" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => go("changes_requested")} className="btn btn-sm btn-secondary">Request changes</button>
        <button disabled={busy} onClick={() => go("approved")} className="btn btn-sm btn-primary">Approve spec &amp; build</button>
      </div>
    </div>
  );
}

export function ShipButton({ id, allowed, why }: { id: number; allowed: boolean; why: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!allowed) return <button disabled title={why} className="btn btn-sm cursor-not-allowed border border-dashed border-slate-300 text-slate-400">Push to prod</button>;
  return (
    <button disabled={busy} className="btn btn-sm btn-success" onClick={async () => {
      if (!confirm("Merge this PR and put the app in production?")) return;
      setBusy(true);
      const r = await shipRequestAction({ id });
      setBusy(false);
      toast(r.message, r.ok ? "success" : "error");
      router.refresh();
    }}>{busy ? "Merging…" : "Push to prod"}</button>
  );
}
