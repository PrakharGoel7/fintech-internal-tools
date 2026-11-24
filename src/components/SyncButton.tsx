"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { runSyncAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";

/** Runs one of the app's inbound syncs by hand; changes are applied as actions by the connector's service account. */
export function SyncButton({ appSlug, syncId, label, lastRun }: { appSlug: string; syncId: string; label: string; lastRun: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const res = await runSyncAction({ appSlug, syncId });
    setBusy(false);
    toast(res.message, res.ok ? "success" : "error");
    router.refresh();
  }
  return (
    <span className="flex items-center gap-2 text-xs text-slate-500">
      {lastRun && <span>Last synced {lastRun}</span>}
      <button data-sync={syncId} onClick={run} disabled={busy} className="btn btn-sm btn-secondary">{busy ? "Syncing…" : label}</button>
    </span>
  );
}
