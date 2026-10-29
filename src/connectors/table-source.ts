import { getDb, registerTable, type Row } from "@/platform/db";
import { maskRow } from "@/platform/pii";
import { matches, type Condition } from "@/platform/conditions";

export interface SourceDef {
  name: string;
  table: string;
  label: string;
  pk: string;
  titleField: string;
  /** Fields tagged as PII are masked server-side for every read. */
  piiFields: string[];
  searchFields: string[];
  defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Column order = table column order. The table is created from this definition. */
  fields: Record<string, FieldDef>;
}

export type Tone = "neutral" | "info" | "good" | "warn" | "bad" | "accent";

export interface FieldDef {
  label: string;
  type: "text" | "number" | "currency" | "date" | "boolean" | "status";
  /** For status fields: badge tone per value. Common workflow words have defaults. */
  tones?: Record<string, Tone>;
}

const SQL_TYPE: Record<FieldDef["type"], string> = { text: "TEXT", status: "TEXT", date: "TEXT", number: "NUMERIC", currency: "REAL", boolean: "INTEGER" };

export function tableDdl(def: SourceDef): string {
  const cols = Object.entries(def.fields).map(([k, f]) => `  ${k} ${SQL_TYPE[f.type]}${k === def.pk ? " PRIMARY KEY" : ""}`);
  return `CREATE TABLE IF NOT EXISTS ${def.table} (\n${cols.join(",\n")}\n);`;
}

export interface ListOptions {
  where?: Condition[];
  search?: string;
  sort?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}

/** L2 connector over a SQL table. Blocks talk to this, never to the database. */
export class TableSource {
  constructor(public def: SourceDef) {
    registerTable(tableDdl(def));
  }

  private all(): Row[] {
    return getDb().prepare(`SELECT * FROM ${this.def.table}`).all() as Row[];
  }

  listRaw(opts: ListOptions = {}): Row[] {
    let rows = this.all().filter((r) => matches(opts.where, r));
    if (opts.search) {
      const q = opts.search.toLowerCase();
      rows = rows.filter((r) => this.def.searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
    }
    const sort = opts.sort ?? this.def.defaultSort;
    if (sort) {
      rows.sort((a, b) => {
        const av = a[sort.field] as string | number, bv = b[sort.field] as string | number;
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? c : -c;
      });
    }
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  list(opts: ListOptions = {}): Row[] {
    return this.listRaw(opts).map((r) => maskRow(r, this.def.piiFields));
  }

  getRaw(id: string): Row | null {
    return (getDb().prepare(`SELECT * FROM ${this.def.table} WHERE ${this.def.pk} = ?`).get(id) as Row) ?? null;
  }

  get(id: string): Row | null {
    const r = this.getRaw(id);
    return r ? maskRow(r, this.def.piiFields) : null;
  }

  update(id: string, patch: Row): Row {
    const keys = Object.keys(patch).filter((k) => k !== this.def.pk);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(", ");
      getDb()
        .prepare(`UPDATE ${this.def.table} SET ${sets} WHERE ${this.def.pk} = ?`)
        .run(...keys.map((k) => patch[k] as string | number | null), id);
    }
    return this.getRaw(id)!;
  }

  create(values: Row): Row {
    const keys = Object.keys(values);
    getDb()
      .prepare(`INSERT INTO ${this.def.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`)
      .run(...keys.map((k) => values[k] as string | number | null));
    return this.getRaw(String(values[this.def.pk]))!;
  }
}
