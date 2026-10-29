import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "./session";
import { USERS, listApprovals, canDecide } from "@/platform";
import { UserSwitcher } from "@/components/UserSwitcher";
import { NavLinks } from "@/components/NavLinks";
import { Toaster } from "@/components/Toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = { title: "Internal Tools · built by Devin", description: "Composable internal apps platform" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const mine = listApprovals({ status: "pending" }).filter((a) => canDecide(user, a).ok).length;
  const nav: [string, string][] = [["/", "Apps"], ["/approvals", "Approvals"], ["/audit", "Audit log"], ["/catalog", "Module catalog"], ["/request", "Request an app"]];
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900"><span className="grid h-7 w-7 place-items-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm text-white shadow-sm ring-1 ring-brand-700/20">⌘</span>Internal Tools</Link>
            <NavLinks items={nav} badges={{ "/approvals": mine }} />
            <div className="ml-auto"><UserSwitcher current={user.id} users={USERS.map((u) => ({ id: u.id, label: `${u.name} — ${u.title}` }))} /></div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
