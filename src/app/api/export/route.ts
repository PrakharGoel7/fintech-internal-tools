import { getApp } from "@/apps/registry";
import { getSource } from "@/connectors";
import { assertCan, audit } from "@/platform";
import { manifests } from "@/blocks/manifests";
import { gridQuery } from "@/blocks/data-grid/DataGrid";
import { resolveColumns } from "@/blocks/_shared/format";
import { configSchema } from "@/blocks/data-grid/manifest";
import { getCurrentUser } from "@/app/session";

/** Audited CSV export for data-grid blocks. PII stays masked in exports. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams);
  try {
    const user = await getCurrentUser();
    const app = getApp(sp.app);
    assertCan(user, app, "export");
    const block = app.pages.find((p) => p.id === sp.page)?.blocks[Number(sp.block)];
    if (!block || block.type !== manifests["data-grid"].name) throw new Error("Not an exportable grid");
    const config = configSchema.parse(block.config);
    if (!config.exportable) throw new Error("Export disabled for this grid");
    const source = getSource(config.source);
    const rows = source.list(gridQuery(config, sp));
    const cols = resolveColumns(config.columns, source.def);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.field])).join(","))].join("\n");
    audit({ actor: user.id, app: app.slug, action: "data.exported", source: config.source, details: { rows: rows.length, filters: sp } });
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${app.slug}-${config.source}.csv"` } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "error", { status: 403 });
  }
}
