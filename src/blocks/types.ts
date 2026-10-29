import type { z } from "zod";
import type { ReactNode } from "react";
import type { AppModule, User } from "@/platform";

export type BlockCategory = "data" | "workflow" | "insight" | "input" | "collaboration" | "governance";

/** Machine-readable contract for an L3 block. This is what Devin reads (via catalog.json) to pick blocks. */
export interface BlockManifest<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  version: string;
  category: BlockCategory;
  summary: string;
  useWhen: string[];
  notFor: string[];
  /** Platform guarantees the block relies on. */
  requires: string[];
  /** Audit events the block can cause. */
  emitsAudit: string[];
  /** Permissions (app-level keys) the block checks. */
  permissions: string[];
  configSchema: S;
  example: z.input<S>;
}

export interface BlockContext {
  app: AppModule;
  user: User;
  /** Route params from the page path, e.g. { id: "KYC-1001" } */
  params: Record<string, string>;
  search: Record<string, string>;
  /** /apps/<slug> */
  basePath: string;
  /** Current pathname, without query string */
  pathname: string;
  pageId: string;
  blockIndex: number;
}

export interface BlockProps<C> {
  config: C;
  ctx: BlockContext;
  title?: string;
}

export interface BlockDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  manifest: BlockManifest<S>;
  Component: (props: BlockProps<z.infer<S>>) => ReactNode | Promise<ReactNode>;
}
