"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items, badges }: { items: [string, string][]; badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {items.map(([href, label]) => {
        const active = href === "/" ? pathname === "/" || pathname.startsWith("/apps") : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            {label}
            {badges[href] > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">{badges[href]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
