import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "./session";
import { USERS, listApprovals, canDecide } from "@/platform";
import { UserSwitcher } from "@/components/UserSwitcher";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = { title: "Internal Tools · built by Devin", description: "Composable internal apps platform" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const mine = listApprovals({ status: "pending" }).filter((a) => canDecide(user, a).ok).length;
  const nav = [["/", "Apps"], ["/approvals", "Approvals"], ["/audit", "Audit log"], ["/catalog", "Module catalog"], ["/request", "Request an app"]];
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold"><span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">⌘</span>Internal Tools</Link>
            <nav className="flex gap-1 text-sm">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {label}{href === "/approvals" && mine > 0 && <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 text-xs font-semibold text-white">{mine}</span>}
                </Link>
              ))}
            </nav>
            <div className="ml-auto"><UserSwitcher current={user.id} users={USERS.map((u) => ({ id: u.id, label: `${u.name} — ${u.title}` }))} /></div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
