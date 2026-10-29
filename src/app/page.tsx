import Link from "next/link";
import { getCurrentUser } from "./session";
import { apps } from "@/apps/registry";
import { can } from "@/platform";
import { manifests } from "@/blocks/manifests";
import { AppIcon } from "@/components/AppIcon";

export default async function Home() {
  const user = await getCurrentUser();
  const visible = apps.filter((a) => can(user, a, "view"));
  const hidden = apps.length - visible.length;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Apps</h1>
          <p className="text-sm text-slate-500">Signed in as <b>{user.name}</b> ({user.roles.join(", ")}). Each app is one config file composed from {Object.keys(manifests).length} reusable blocks.</p>
        </div>
        <Link href="/request" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Request a new app</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((a) => {
          const used = [...new Set(a.pages.flatMap((p) => p.blocks.map((b) => b.type)))];
          return (
            <Link key={a.slug} href={`/apps/${a.slug}`} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow">
              <div className="flex items-center gap-3">
                <AppIcon app={a} size="lg" />
                <div>
                  <div className="font-semibold group-hover:text-indigo-700">{a.name}</div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">{a.category}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{a.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">{used.map((b) => <span key={b} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{b}</span>)}</div>
            </Link>
          );
        })}
      </div>
      {hidden > 0 && <p className="mt-4 text-xs text-slate-400">{hidden} app(s) hidden — your role doesn&apos;t have access. Switch user (top right) to explore other roles.</p>}
    </div>
  );
}
