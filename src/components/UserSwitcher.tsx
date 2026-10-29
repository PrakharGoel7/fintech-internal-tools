"use client";
import { useRouter } from "next/navigation";
import { switchUserAction } from "@/app/server-actions";

export function UserSwitcher({ current, users }: { current: string; users: { id: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">MOCK SSO</span>
      <select value={current} onChange={async (e) => { await switchUserAction(e.target.value); router.refresh(); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
        {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </label>
  );
}
