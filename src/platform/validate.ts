import { manifests } from "@/blocks/manifests";
import { sources } from "@/connectors";
import { externalConnectors } from "@/connectors/external";
import { approvalRules, type AppModule } from "./app-definition";
import { ROLES } from "./users";

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
    const rules = approvalRules(a);
    for (const rule of rules) for (const r of rule.approverRoles) if (!roles.has(r)) errs.push(`action ${id}: unknown approver role "${r}"`);
    const fields = sources[a.source]?.def.fields ?? {};
    for (const c of [...(a.availableWhen ?? []), ...rules.flatMap((r) => r.when)])
      if (sources[a.source] && !fields[c.field]) errs.push(`action ${id}: condition on unknown field "${c.field}"`);
    if ((a.pendingStatus || a.rejectedStatus) && !rules.length) errs.push(`action ${id}: pendingStatus/rejectedStatus require an approval rule`);
    if (a.rejectedStatus && !a.pendingStatus) errs.push(`action ${id}: rejectedStatus requires pendingStatus`);
    if ((a.pendingStatus || a.rejectedStatus) && sources[a.source] && !fields[a.statusField]) errs.push(`action ${id}: statusField "${a.statusField}" is not a field of "${a.source}"`);
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
      if (typeof cfg.source === "string" && !sources[cfg.source]) errs.push(`${where}: unknown source "${cfg.source}"`);
      const refs = JSON.stringify(cfg).match(/"(?:claimAction|submitAction|action)":"([^"]+)"/g) ?? [];
      const listRefs = [...((cfg.rowActions as string[]) ?? []), ...((cfg.actions as string[]) ?? []), ...((cfg.decisionActions as string[]) ?? [])];
      for (const r of [...refs.map((x) => x.split(":")[1].replace(/"/g, "")), ...listRefs])
        if (!app.actions[r]) errs.push(`${where}: references undefined action "${r}"`);
    });
  }
  return errs;
}
