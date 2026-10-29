"use client";
import { useRouter } from "next/navigation";
import { switchUserAction } from "@/app/server-actions";

export function UserSwitcher({ current, users }: { current: string; users: { id: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="badge bg-amber-50 text-[10px] font-semibold tracking-wide text-amber-800 ring-amber-600/25">MOCK SSO</span>
      <select value={current} onChange={async (e) => { await switchUserAction(e.target.value); router.refresh(); }} className="input">
        {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </label>
  );
}
