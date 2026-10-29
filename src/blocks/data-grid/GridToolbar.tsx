"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function GridToolbar({ searchable, filters }: { searchable: boolean; filters: { field: string; label: string; options: string[] }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.push(`${pathname}?${p}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchable && (
        <form onSubmit={(e) => { e.preventDefault(); set("q", q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input w-44 text-xs" />
        </form>
      )}
      {filters.map((f) => (
        <select key={f.field} value={sp.get(`f_${f.field}`) ?? ""} onChange={(e) => set(`f_${f.field}`, e.target.value)} className="input text-xs">
          <option value="">{f.label}: all</option>
          {f.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
      ))}
    </div>
  );
}
