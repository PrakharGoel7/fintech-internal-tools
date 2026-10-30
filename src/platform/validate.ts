import { manifests } from "@/blocks/manifests";
import { sources } from "@/connectors";
import { externalConnectors } from "@/connectors/external";
import type { AppModule } from "./app-definition";
import { ROLES } from "./users";

/** Config keys the schema doesn't know (zod strips them silently), e.g. an option a block removed. */
export function unknownKeys(input: unknown, parsed: unknown, path = ""): string[] {
  if (Array.isArray(input) && Array.isArray(parsed)) return input.flatMap((v, i) => unknownKeys(v, parsed[i], `${path}[${i}]`));
  if (!input || !parsed || typeof input !== "object" || typeof parsed !== "object" || Array.isArray(input)) return [];
  const p = parsed as Record<string, unknown>;
  return Object.entries(input).flatMap(([k, v]) => (k in p ? unknownKeys(v, p[k], path ? `${path}.${k}` : k) : [path ? `${path}.${k}` : k]));
}

/** Static checks that go beyond the zod schema: references between actions, blocks, sources, roles, handlers. */
export function validateApp(app: AppModule): string[] {
  const errs: string[] = [];
  const roles = new Set<string>(ROLES);
  for (const [perm, rs] of Object.entries(app.permissions))
    for (const r of rs) if (!roles.has(r)) errs.push(`permission "${perm}" references unknown role "${r}"`);

  for (const [id, a] of Object.entries(app.actions)) {
    if (!sources[a.source]) errs.push(`action ${id}: unknown source "${a.source}"`);
    if (!app.permissions[a.permission]) errs.push(`action ${id}: permission "${a.permission}" not declared in app.permissions`);
    if (a.effect.kind === "connector" && !externalConnectors[a.effect.connector]?.[a.effect.op]) errs.push(`action ${id}: unknown connector op ${a.effect.connector}.${a.effect.op}`);
    if (a.effect.kind === "handler" && !app.handlers?.[a.effect.name]) errs.push(`action ${id}: handler "${a.effect.name}" not defined`);
    if (a.approval) for (const r of a.approval.approverRoles) if (!roles.has(r)) errs.push(`action ${id}: unknown approver role "${r}"`);
    const fields = sources[a.source]?.def.fields ?? {};
    for (const f of a.notBy ?? []) if (sources[a.source] && !fields[f]) errs.push(`action ${id}: notBy references unknown field "${f}"`);
    for (const c of [...(a.availableWhen ?? []), ...(a.approval?.when ?? [])])
      if (sources[a.source] && !fields[c.field]) errs.push(`action ${id}: condition on unknown field "${c.field}"`);
  }

  const seenPaths = new Set<string>();
  for (const p of app.pages) {
    if (seenPaths.has(p.path)) errs.push(`duplicate page path "${p.path}"`);
    seenPaths.add(p.path);
    p.blocks.forEach((b, i) => {
      const where = `page ${p.id} block #${i} (${b.type})`;
      const m = manifests[b.type];
      if (!m) return errs.push(`${where}: unknown block type — see catalog.json`);
      const parsed = m.configSchema.safeParse(b.config);
      if (!parsed.success) return errs.push(`${where}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
      const cfg = parsed.data as Record<string, unknown>;
      for (const k of unknownKeys(b.config, cfg)) errs.push(`${where}: unknown option "${k}" — see catalog.json`);
      if (typeof cfg.source === "string" && !sources[cfg.source]) errs.push(`${where}: unknown source "${cfg.source}"`);
      const refs = JSON.stringify(cfg).match(/"(?:claimAction|submitAction|action)":"([^"]+)"/g) ?? [];
      const listRefs = [...((cfg.rowActions as string[]) ?? []), ...((cfg.actions as string[]) ?? []), ...((cfg.decisionActions as string[]) ?? [])];
      for (const r of [...refs.map((x) => x.split(":")[1].replace(/"/g, "")), ...listRefs])
        if (!app.actions[r]) errs.push(`${where}: references undefined action "${r}"`);
    });
  }
  return errs;
}
