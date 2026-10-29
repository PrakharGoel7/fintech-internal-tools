import fs from "node:fs";
import path from "node:path";

export type Bump = "none" | "patch" | "minor" | "major";
const RANK: Record<Bump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** Semver level of `from` → `to` ("none" if equal, null if it went backwards). */
export function bumpOf(from: string, to: string): Bump | null {
  const a = from.split(".").map(Number), b = to.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return (["major", "minor", "patch"] as const)[i];
    if (b[i] < a[i]) return null;
  }
  return "none";
}
export const atLeast = (have: Bump, need: Bump) => RANK[have] >= RANK[need];

type Schema = { type?: unknown; properties?: Record<string, Schema>; required?: string[]; items?: Schema; enum?: unknown[]; anyOf?: Schema[] } & Record<string, unknown>;

/**
 * How a block's config schema changed, from the point of view of existing app configs:
 * "major" if a config that was valid may now be invalid (field removed, newly required, type narrowed),
 * "minor" if only optional fields / enum values were added, "none" if identical.
 */
export function schemaChange(beforeIn: object, afterIn: object): Bump {
  const before = beforeIn as Schema, after = afterIn as Schema;
  if (JSON.stringify(before) === JSON.stringify(after)) return "none";
  if (JSON.stringify(before.type) !== JSON.stringify(after.type)) return "major";
  let level: Bump = "none";
  const raise = (b: Bump) => { if (RANK[b] > RANK[level]) level = b; };
  if (before.enum || after.enum) {
    const a = before.enum ?? [], b = after.enum ?? [];
    if (a.some((v) => !b.some((w) => JSON.stringify(w) === JSON.stringify(v)))) return "major";
    if (b.length > a.length) raise("minor");
  }
  const reqBefore = new Set(before.required ?? []);
  for (const r of after.required ?? []) if (!reqBefore.has(r)) return "major";
  if (before.required?.some((r) => !after.required?.includes(r))) raise("minor");
  const pa = before.properties ?? {}, pb = after.properties ?? {};
  for (const k of Object.keys(pa)) {
    if (!(k in pb)) return "major";
    raise(schemaChange(pa[k], pb[k]));
  }
  if (Object.keys(pb).some((k) => !(k in pa))) raise("minor");
  if (before.items && after.items) raise(schemaChange(before.items, after.items));
  if (before.anyOf && after.anyOf) {
    if (after.anyOf.length < before.anyOf.length) return "major";
    before.anyOf.forEach((s, i) => raise(schemaChange(s, after.anyOf![i])));
    if (after.anyOf.length > before.anyOf.length) raise("minor");
  }
  const rest = (s: Schema) => JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !["properties", "required", "items", "enum", "anyOf", "description", "default"].includes(k))));
  if (rest(before) !== rest(after)) return "major";
  return level === "none" ? "patch" : level;
}

/** Static import graph over src/: file → files it imports (resolved, repo-relative). */
export function importGraph(root = "src"): Map<string, string[]> {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(root).filter((f) => /\.(ts|tsx)$/.test(f));
  const resolve = (from: string, spec: string) => {
    const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((c) => files.includes(c)) ?? null;
  };
  return new Map(files.map((f) => [f, [...fs.readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => resolve(f, m[1])).filter((x): x is string => !!x)]));
}

/** All files reachable from `start` without leaving `within` (path prefixes). */
export function closure(graph: Map<string, string[]>, start: string[], within: string[]): string[] {
  const seen = new Set<string>(), stack = [...start];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || !within.some((w) => f.startsWith(w))) continue;
    seen.add(f);
    stack.push(...(graph.get(f) ?? []));
  }
  return [...seen].sort();
}
