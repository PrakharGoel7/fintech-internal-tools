import Link from "next/link";
import { notFound } from "next/navigation";
import { apps } from "@/apps/registry";
import { can, type PageDef } from "@/platform";
import { blocks } from "@/blocks/registry";
import { getCurrentUser } from "@/app/session";
import { AppIcon } from "@/components/AppIcon";

function matchPage(pages: PageDef[], segs: string[]) {
  for (const p of pages) {
    const parts = p.path ? p.path.split("/") : [];
    if (parts.length !== segs.length) continue;
    const params: Record<string, string> = {};
    if (parts.every((part, i) => (part.startsWith(":") ? ((params[part.slice(1)] = decodeURIComponent(segs[i])), true) : part === segs[i]))) return { page: p, params };
  }
  return null;
}

const WIDTH = { full: "lg:col-span-6", half: "lg:col-span-3", third: "lg:col-span-2", "two-thirds": "lg:col-span-4" };

export default async function AppPage({ params, searchParams }: { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<Record<string, string>> }) {
  const { slug, path = [] } = await params;
  const search = await searchParams;
  const app = apps.find((a) => a.slug === slug);
  if (!app) notFound();
  const user = await getCurrentUser();
  if (!can(user, app, "view")) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700"><b>Access denied.</b> {user.name} ({user.roles.join(", ")}) is not allowed to view {app.name}. Allowed roles: {app.permissions.view.join(", ")}.</div>;
  }
  const m = matchPage(app.pages, path);
  if (!m) notFound();
  const basePath = `/apps/${app.slug}`;
  const pathname = `${basePath}${path.length ? "/" + path.join("/") : ""}`;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <AppIcon app={app} size="lg" />
        <div>
          <h1 className="text-xl font-semibold">{app.name}</h1>
          <p className="text-xs text-slate-500">config: <code className="font-mono">src/apps/{app.slug}/app.ts</code></p>
        </div>
        <nav className="ml-auto flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {app.pages.filter((p) => p.nav && !p.path.includes(":")).map((p) => (
            <Link key={p.id} href={`${basePath}${p.path ? "/" + p.path : ""}`} className={`rounded-md px-3 py-1 ${p.id === m.page.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{p.title}</Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        {m.page.blocks.map((b, i) => {
          const def = blocks[b.type];
          const parsed = def?.manifest.configSchema.safeParse(b.config);
          return (
            <div key={i} className={WIDTH[b.width]}>
              {!def ? <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">Unknown block “{b.type}”</div>
                : !parsed!.success ? <pre className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-700">Invalid config for {b.type}:{"\n"}{parsed!.error.message}</pre>
                : <def.Component config={parsed!.data} title={b.title} ctx={{ app, user, params: m.params, search, basePath, pathname, pageId: m.page.id, blockIndex: i }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
