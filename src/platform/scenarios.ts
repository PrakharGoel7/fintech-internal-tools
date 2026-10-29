import type { Role } from "./users";

type Values = Record<string, unknown>;

interface Base {
  /** Plain-language sentence the requester confirms, e.g. "A refund over $500 waits for Finance Lead approval". */
  says: string;
  /** User id from users.ts acting in the scenario. */
  as: string;
  /** Starting record (unlisted fields get neutral defaults). For create actions: the submitted values. `"$now-2h"` / `"$now+3d"` resolve to timestamps. */
  given?: Values;
  /** Data source; defaults to the action's source. */
  source?: string;
}

interface ActionStep {
  do: string;
  /** Defaults to the action's first reason code; pass "" to test a missing reason. */
  reason?: string;
  /** Defaults to a placeholder when the action requires a note; pass "" to test a missing note. */
  note?: string;
  input?: Values;
  /** Expected record fields afterwards. */
  then?: Values;
}

/**
 * Requester-confirmed acceptance scenarios for one app (`src/apps/<slug>/scenarios.ts`).
 * tests/scenarios.test.ts runs every scenario through the real platform (RBAC, runAction, maker-checker, PII).
 */
export type Scenario =
  | (Base & { open: true; expect: "allowed" | "denied" })
  | (Base & { masked: string[] })
  | (Base & { reveal: string; expect: "allowed" | "denied" })
  | (Base & ActionStep & { expect: "allowed" | "denied" | "blocked"; /** Case-insensitive pattern the error must match. */ because?: string })
  | (Base & ActionStep & { expect: "needs-approval"; approvers?: Role[]; approvedBy?: string; rejectedBy?: string });

export interface ScenarioSet {
  app: string;
  scenarios: Scenario[];
}

export function defineScenarios(app: string, scenarios: Scenario[]): ScenarioSet {
  return { app, scenarios };
}
