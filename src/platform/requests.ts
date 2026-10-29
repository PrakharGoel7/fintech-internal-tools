import { getDb, type Row } from "./db";
import { audit } from "./audit";
import type { User } from "./users";

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
export function buildDevinPrompt(req: AppRequestInput, requester: User, repo: string) {
  return `Use the build-internal-app skill in ${repo} (.agents/skills/build-internal-app/SKILL.md) to handle this internal app request.

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

Start with Phase 1 (spec + gap analysis) and post the spec for approval before building.`;
}

export async function submitAppRequest(user: User, req: AppRequestInput) {
  if (!req.title?.trim() || !req.problem?.trim()) throw new Error("Title and problem are required");
  const repo = process.env.GITHUB_REPO ?? "PrakharGoel7/fintech-internal-tools";
  const prompt = buildDevinPrompt(req, user, repo);
  const db = getDb();
  const res = db.prepare("INSERT INTO app_requests (ts, requested_by, title, body, status) VALUES (?, ?, ?, ?, 'submitted')")
    .run(new Date().toISOString(), user.id, req.title.trim(), JSON.stringify(req));
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
