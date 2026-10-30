import Link from "next/link";
import { getCurrentUser } from "./session";
import { apps } from "@/apps/registry";
import { can } from "@/platform";
import { AppIcon } from "@/components/AppIcon";

export default async function Home() {
  const user = await getCurrentUser();
  const visible = apps.filter((a) => can(user, a, "view"));
  const hidden = apps.length - visible.length;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
          <p className="mt-1 text-sm text-slate-500">{user.name} · {user.title}</p>
        </div>
        <Link href="/request" className="btn btn-sm btn-primary">Request an app</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((a) => {
          return (
            <Link key={a.slug} href={`/apps/${a.slug}`} className="group card p-5 transition hover:-translate-y-px hover:border-brand-200 hover:shadow-md">
              <div className="flex items-center gap-3">
                <AppIcon app={a} size="lg" />
                <div>
                  <div className="font-semibold tracking-tight group-hover:text-brand-700">{a.name}</div>
                  <div className="eyebrow text-slate-400">{a.category}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{a.description}</p>
            </Link>
          );
        })}
      </div>
      {hidden > 0 && <p className="mt-4 text-xs text-slate-400">{hidden} more {hidden === 1 ? "app needs" : "apps need"} a different role.</p>}
    </div>
  );
}
