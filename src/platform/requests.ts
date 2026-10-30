import { randomBytes } from "node:crypto";
import { getDb, type Row } from "./db";
import { audit } from "./audit";
import { ForbiddenError } from "./rbac";
import type { Role, User } from "./users";
import { checksFor, commentOnPull, findRequestPull, githubConfigured, mergePull, type Checks, type Pull } from "./github";

/** Who reviews app requests in the portal's Requests dashboard, and who may push a built app to production. */
export const REQUEST_REVIEW_ROLES: Role[] = ["engineer", "eng-lead"];
export const SHIP_ROLES: Role[] = ["eng-lead"];
export const canReviewRequests = (u: User) => u.roles.some((r) => REQUEST_REVIEW_ROLES.includes(r));
export const canShip = (u: User) => u.roles.some((r) => SHIP_ROLES.includes(r));

export interface AppRequestInput {
  title: string;
  team: string;
  users: string;
  problem: string;
  data: string;
  actions: string;
  approvals: string;
  sensitive: string[];
  urgency: string;
}

/** The prompt handed to Devin. It deliberately points at the repo skill so behaviour lives in version control. */
export function buildDevinPrompt(req: AppRequestInput, requester: User, repo: string, ref: string, baseBranch = process.env.APP_BASE_BRANCH) {
  const branch = baseBranch ? ` on branch ${baseBranch} (base your work and PR on it)` : "";
  return `Use the build-internal-app skill in ${repo}${branch} (.agents/skills/build-internal-app/SKILL.md) to handle this internal app request.

Request ref: ${ref} (name your branch app-request/${ref}-<slug> and put "App-Request: ${ref}" in the PR description so the portal's Requests dashboard can track it)
Requested by: ${requester.name} (${requester.title})
Title: ${req.title}
Team: ${req.team}
Who will use it: ${req.users}
Problem / current process: ${req.problem}
Data involved: ${req.data}
Actions/decisions users take: ${req.actions}
Approvals needed: ${req.approvals || "none stated"}
Sensitive data: ${req.sensitive.join(", ") || "none stated"}
Urgency: ${req.urgency}

Start with Phase 1. The requester is not technical: do not ask them questions; record every ambiguity as an assumption (stricter option for approvals and PII). Write the spec plus the scenarios and journeys as tests, open a draft PR for an engineer to approve, and do not build until an engineer approves it. Engineers review in the portal's Requests dashboard: their spec decision arrives as a message in this session and as a PR comment. When built, mark the PR ready for review; CI records a video of every journey and the dashboard shows them to the engineer, who decides when to push to production.`;
}

export async function submitAppRequest(user: User, req: AppRequestInput) {
  if (!req.title?.trim() || !req.problem?.trim()) throw new Error("Title and problem are required");
  const repo = process.env.GITHUB_REPO ?? "PrakharGoel7/fintech-internal-tools";
  const ref = `req-${randomBytes(4).toString("hex")}`;
  const prompt = buildDevinPrompt(req, user, repo, ref);
  const db = getDb();
  const res = db.prepare("INSERT INTO app_requests (ts, requested_by, title, body, status, ref) VALUES (?, ?, ?, ?, 'submitted', ?)")
    .run(new Date().toISOString(), user.id, req.title.trim(), JSON.stringify(req), ref);
  const id = Number(res.lastInsertRowid);

  let issueUrl: string | null = null;
  let sessionUrl: string | null = null;
  const notes: string[] = [];

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/issues`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ title: `[App request] ${req.title}`, body: prompt, labels: ["app-request"] }),
    });
    if (r.ok) issueUrl = (await r.json()).html_url; else notes.push(`GitHub issue failed (${r.status})`);
  }
  if (process.env.DEVIN_API_KEY) {
    const orgId = process.env.DEVIN_ORG_ID;
    const url = orgId
      ? `https://api.devin.ai/v3/organizations/${orgId}/sessions`
      : "https://api.devin.ai/v1/sessions";
    const body = orgId
      ? { prompt, title: `App request: ${req.title}`, repos: [repo], tags: ["app-request"] }
      : { prompt, title: `App request: ${req.title}`, idempotent: true };
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DEVIN_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const data = await r.json();
      sessionUrl = data.url ?? (data.session_id ? `https://app.devin.ai/sessions/${String(data.session_id).replace(/^devin-/, "")}` : null);
    } else notes.push(`Devin API failed (${r.status})`);
  }
  const status = sessionUrl ? "devin_started" : issueUrl ? "issue_filed" : "submitted";
  db.prepare("UPDATE app_requests SET status=?, issue_url=?, devin_session_url=? WHERE id=?").run(status, issueUrl, sessionUrl, id);
  audit({ actor: user.id, action: "app_request.submitted", source: "app_requests", recordId: String(id), details: { title: req.title, status, issueUrl, sessionUrl } });

  const message = sessionUrl ? "Devin session started" : issueUrl ? "GitHub issue filed — Devin automation will pick it up" : `Request saved${notes.length ? ` (${notes.join("; ")})` : " (no GITHUB_TOKEN/DEVIN_API_KEY configured — copy the prompt below into Devin)"}`;
  return { id, prompt, issueUrl, sessionUrl, message };
}

export function listAppRequests(): Row[] {
  return getDb().prepare("SELECT * FROM app_requests ORDER BY id DESC").all() as Row[];
}

export interface AppRequest {
  id: number; ts: string; requestedBy: string; title: string; input: AppRequestInput; status: string; ref: string | null;
  sessionUrl: string | null; issueUrl: string | null; specDecision: "approved" | "changes_requested" | null; specDecisionSha: string | null; specDecisionBy: string | null; shippedBy: string | null;
}
const toRequest = (r: Row): AppRequest => ({
  id: Number(r.id), ts: String(r.ts), requestedBy: String(r.requested_by), title: String(r.title), input: JSON.parse(String(r.body)), status: String(r.status),
  ref: (r.ref as string) ?? null, sessionUrl: (r.devin_session_url as string) ?? null, issueUrl: (r.issue_url as string) ?? null,
  specDecision: (r.spec_decision as AppRequest["specDecision"]) ?? null, specDecisionSha: (r.spec_decision_sha as string) ?? null,
  specDecisionBy: (r.spec_decision_by as string) ?? null, shippedBy: (r.shipped_by as string) ?? null,
});
export const getAppRequests = () => listAppRequests().map(toRequest);
export function getAppRequest(id: number): AppRequest | null {
  const r = getDb().prepare("SELECT * FROM app_requests WHERE id = ?").get(id) as Row | undefined;
  return r ? toRequest(r) : null;
}

export type Stage = "submitted" | "drafting" | "spec_review" | "changes_requested" | "building" | "testing" | "checks_failing" | "ready_to_ship" | "live" | "closed";
export const STAGES: Record<Stage, { label: string; tone: "neutral" | "info" | "good" | "warn" | "bad"; waitingOn: "engineer" | "devin" | "nobody" }> = {
  submitted: { label: "Submitted", tone: "neutral", waitingOn: "devin" },
  drafting: { label: "Drafting spec", tone: "info", waitingOn: "devin" },
  spec_review: { label: "Spec ready for review", tone: "warn", waitingOn: "engineer" },
  changes_requested: { label: "Changes requested", tone: "info", waitingOn: "devin" },
  building: { label: "Building", tone: "info", waitingOn: "devin" },
  testing: { label: "Running tests", tone: "info", waitingOn: "devin" },
  checks_failing: { label: "Checks failing", tone: "bad", waitingOn: "devin" },
  ready_to_ship: { label: "Ready to ship", tone: "warn", waitingOn: "engineer" },
  live: { label: "Live", tone: "good", waitingOn: "nobody" },
  closed: { label: "Closed", tone: "neutral", waitingOn: "nobody" },
};

/** Where a request is, from the Devin session, the PR Devin opened (draft = spec stage) and its CI. */
export function requestStage(r: AppRequest, pull: Pull | null, checks: Checks | null): Stage {
  if (!pull) return r.sessionUrl || r.issueUrl ? "drafting" : "submitted";
  if (pull.merged) return "live";
  if (!pull.open) return "closed";
  if (pull.draft) {
    if (r.specDecision === "approved") return "building";
    if (r.specDecision === "changes_requested" && r.specDecisionSha === pull.headSha) return "changes_requested";
    return "spec_review";
  }
  return checks?.state === "success" ? "ready_to_ship" : checks?.state === "failure" ? "checks_failing" : "testing";
}

export async function loadRequestState(r: AppRequest) {
  if (!r.ref || !githubConfigured()) return { pull: null, checks: null, stage: requestStage(r, null, null), error: githubConfigured() ? null : "GitHub not configured (set GITHUB_TOKEN)" };
  try {
    const pull = await findRequestPull(r.ref);
    const checks = pull ? await checksFor(pull.headSha) : null;
    return { pull, checks, stage: requestStage(r, pull, checks), error: null };
  } catch (e) {
    return { pull: null, checks: null, stage: requestStage(r, null, null), error: (e as Error).message };
  }
}

/** Sends a message into the Devin session that is handling a request (v3 API; the session belongs to the API key's service user). */
async function messageDevin(sessionUrl: string | null, message: string): Promise<string | null> {
  const id = sessionUrl?.match(/sessions\/([0-9a-f]+)/)?.[1];
  if (!id) return "no Devin session";
  if (!process.env.DEVIN_API_KEY || !process.env.DEVIN_ORG_ID) return "DEVIN_API_KEY / DEVIN_ORG_ID not set";
  const r = await fetch(`https://api.devin.ai/v3/organizations/${process.env.DEVIN_ORG_ID}/sessions/devin-${id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEVIN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return r.ok ? null : `Devin API ${r.status}`;
}

export async function decideSpec(user: User, id: number, decision: "approved" | "changes_requested", comment: string) {
  if (!canReviewRequests(user)) throw new ForbiddenError(`${user.name} cannot review app requests`);
  const r = getAppRequest(id);
  if (!r) throw new Error("Request not found");
  if (decision === "changes_requested" && !comment.trim()) throw new Error("Say what should change");
  const { pull, stage } = await loadRequestState(r);
  if (!pull || stage !== "spec_review") throw new Error("This request has no spec waiting for review");
  const text = decision === "approved"
    ? `Spec approved by ${user.name} (${user.title}) in the Requests dashboard.${comment.trim() ? ` Comment: ${comment.trim()}` : ""} Build the app now (Phase 2), then mark PR #${pull.number} ready for review.`
    : `Changes requested by ${user.name} (${user.title}) in the Requests dashboard: ${comment.trim()}\nUpdate the spec and scenarios/journeys on PR #${pull.number}, push, and wait for review again. Do not build yet.`;
  const problems = [await messageDevin(r.sessionUrl, text)];
  await commentOnPull(pull.number, `**${decision === "approved" ? "Spec approved" : "Changes requested"}** by ${user.name} (${user.title}) via the Requests dashboard.${comment.trim() ? `\n\n> ${comment.trim()}` : ""}`).catch((e: Error) => problems.push(e.message));
  getDb().prepare("UPDATE app_requests SET spec_decision=?, spec_decision_sha=?, spec_decision_by=? WHERE id=?").run(decision, pull.headSha, user.id, id);
  audit({ actor: user.id, action: `app_request.spec_${decision}`, source: "app_requests", recordId: String(id), details: { pr: pull.number, sha: pull.headSha, comment: comment.trim() || null } });
  return { problems: problems.filter((p): p is string => !!p) };
}

export async function shipRequest(user: User, id: number) {
  if (!canShip(user)) throw new ForbiddenError(`Only ${SHIP_ROLES.join(" / ")} can push apps to production`);
  const r = getAppRequest(id);
  if (!r) throw new Error("Request not found");
  const { pull, stage } = await loadRequestState(r);
  if (!pull || stage !== "ready_to_ship") throw new Error("Only a built app with passing checks can be pushed to production");
  await mergePull(pull.number, `${pull.title} (#${pull.number})`);
  getDb().prepare("UPDATE app_requests SET status='live', shipped_by=? WHERE id=?").run(user.id, id);
  audit({ actor: user.id, action: "app_request.shipped", source: "app_requests", recordId: String(id), details: { pr: pull.number, sha: pull.headSha } });
  await messageDevin(r.sessionUrl, `${user.name} pushed PR #${pull.number} to production (merged). Nothing more to do.`).catch(() => null);
}
