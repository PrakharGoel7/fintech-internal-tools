import fs from "node:fs";
import path from "node:path";
import { unzip } from "./zip";

/** Thin GitHub REST client for the Requests dashboard: finds the PR Devin opened for a request and what is on it. */
const API = "https://api.github.com";
export const githubRepo = () => process.env.GITHUB_REPO ?? "PrakharGoel7/fintech-internal-tools";
const token = () => process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
export const githubConfigured = () => !!token();

async function gh(p: string, init: RequestInit & { raw?: boolean } = {}) {
  const res = await fetch(p.startsWith("http") ? p : `${API}${p}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token()}`, Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${p} → ${res.status}`);
  return res;
}
const json = async <T>(p: string, init?: RequestInit) => (await (await gh(p, init)).json()) as T;

export interface Pull { number: number; url: string; title: string; draft: boolean; open: boolean; merged: boolean; headRef: string; headSha: string }

type ApiPull = { number: number; html_url: string; title: string; draft: boolean; state: string; merged_at: string | null; body: string | null; head: { ref: string; sha: string } };
const toPull = (p: ApiPull): Pull => ({ number: p.number, url: p.html_url, title: p.title, draft: p.draft, open: p.state === "open", merged: !!p.merged_at, headRef: p.head.ref, headSha: p.head.sha });

/** The PR whose description or branch carries the request's ref (`App-Request: <ref>`). */
export async function findRequestPull(ref: string): Promise<Pull | null> {
  const pulls = await json<ApiPull[]>(`/repos/${githubRepo()}/pulls?state=all&per_page=100&sort=created&direction=desc`);
  const p = pulls.find((x) => x.body?.includes(ref) || x.head.ref.includes(ref));
  return p ? toPull(p) : null;
}

export async function pullFiles(n: number): Promise<string[]> {
  return (await json<{ filename: string }[]>(`/repos/${githubRepo()}/pulls/${n}/files?per_page=100`)).map((f) => f.filename);
}

export async function fileAt(file: string, ref: string): Promise<string | null> {
  try { return await (await gh(`/repos/${githubRepo()}/contents/${file}?ref=${encodeURIComponent(ref)}`, { raw: true })).text(); }
  catch { return null; }
}

export interface Checks { state: "none" | "pending" | "success" | "failure"; url?: string }
export async function checksFor(sha: string): Promise<Checks> {
  const { check_runs } = await json<{ check_runs: { status: string; conclusion: string | null; html_url: string }[] }>(`/repos/${githubRepo()}/commits/${sha}/check-runs`);
  if (!check_runs.length) return { state: "none" };
  const url = check_runs[0].html_url;
  if (check_runs.some((r) => r.status !== "completed")) return { state: "pending", url };
  return { state: check_runs.every((r) => ["success", "skipped", "neutral"].includes(r.conclusion ?? "")) ? "success" : "failure", url };
}

export interface JourneyResult { app: string; journey: string; ok: boolean; error?: string; video: string }
const CACHE = () => path.join(process.cwd(), "data", "journey-cache");

/** Downloads (once) the `journey-videos` artifact CI produced for a commit. Returns the journeys' results, or null if CI hasn't produced it. */
export async function journeyVideos(sha: string): Promise<JourneyResult[] | null> {
  const dir = path.join(CACHE(), sha);
  const report = path.join(dir, "report.json");
  if (!fs.existsSync(report)) {
    const { workflow_runs } = await json<{ workflow_runs: { id: number; status: string }[] }>(`/repos/${githubRepo()}/actions/runs?head_sha=${sha}&per_page=10`);
    for (const run of workflow_runs.filter((r) => r.status === "completed")) {
      const { artifacts } = await json<{ artifacts: { name: string; expired: boolean; archive_download_url: string }[] }>(`/repos/${githubRepo()}/actions/runs/${run.id}/artifacts`);
      const a = artifacts.find((x) => x.name === "journey-videos" && !x.expired);
      if (!a) continue;
      const zip = Buffer.from(await (await gh(a.archive_download_url)).arrayBuffer());
      fs.mkdirSync(dir, { recursive: true });
      for (const f of unzip(zip)) fs.writeFileSync(path.join(dir, path.basename(f.name)), f.data);
      break;
    }
  }
  return fs.existsSync(report) ? (JSON.parse(fs.readFileSync(report, "utf8")) as JourneyResult[]) : null;
}

/** Absolute path of a cached journey video, or null (guards against path traversal). */
export function journeyVideoPath(sha: string, file: string): string | null {
  if (!/^[0-9a-f]{40}$/.test(sha) || file !== path.basename(file) || !file.endsWith(".webm")) return null;
  const p = path.join(CACHE(), sha, file);
  return fs.existsSync(p) ? p : null;
}

export async function commentOnPull(n: number, body: string) {
  await gh(`/repos/${githubRepo()}/issues/${n}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

export async function mergePull(n: number, title: string) {
  await gh(`/repos/${githubRepo()}/pulls/${n}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "merge", commit_title: title }) });
}
