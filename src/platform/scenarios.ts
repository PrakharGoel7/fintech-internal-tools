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

export type JourneyStep = { /** Plain-language step, e.g. "Tom escalates the alert to compliance". */ says: string; as: string } & (
  | (Omit<ActionStep, "then"> & {
      /** "done" (default): it happens now. "waits": it goes to Approvals and nothing changes yet. "blocked": it is refused. */
      expect?: "done" | "waits" | "blocked";
      then?: Values;
    })
  | { approve: true; then?: Values }
  | { reject: true; then?: Values }
);

/**
 * A journey takes ONE record through the whole process, step by step, as the real people involved.
 * It starts from a brand-new record (`given`, in the first status) or from a create step, and after the last
 * step the harness also checks the record's audit log lists every step in order, with the right person.
 */
export interface Journey {
  says: string;
  /** Starting record, in the first status of the flow. Omit when the first step creates the record. */
  given?: Values;
  source?: string;
  steps: JourneyStep[];
}

export const isJourney = (s: Scenario | Journey): s is Journey => "steps" in s;

export interface ScenarioSet {
  app: string;
  scenarios: (Scenario | Journey)[];
}

export function defineScenarios(app: string, scenarios: (Scenario | Journey)[]): ScenarioSet {
  return { app, scenarios };
}
