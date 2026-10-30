import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getCurrentUser } from "@/app/session";
import { getUser } from "@/platform";
import { getAppRequest, loadRequestState, canReviewRequests, canShip, STAGES, SHIP_ROLES, REQUEST_REVIEW_ROLES, type Stage } from "@/platform/requests";
import { pullFiles, fileAt, journeyVideos } from "@/platform/github";
import { relative, TONE_CLS } from "@/blocks/_shared/format";
import { SpecReview, ShipButton } from "./ReviewButtons";
import { JourneyVideo } from "./JourneyVideo";

const STEPS: { label: string; stages: Stage[] }[] = [
  { label: "Requested", stages: ["submitted", "drafting"] },
  { label: "Spec review", stages: ["spec_review", "changes_requested"] },
  { label: "Build & test", stages: ["building", "testing", "checks_failing"] },
  { label: "Ready to ship", stages: ["ready_to_ship"] },
  { label: "Live", stages: ["live"] },
];

const FORM: [keyof import("@/platform/requests").AppRequestInput, string][] = [
  ["users", "Who will use it"], ["problem", "Problem / current process"], ["data", "Data involved"], ["actions", "Actions"], ["approvals", "Approvals"], ["sensitive", "Sensitive data"], ["urgency", "Urgency"],
];

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canReviewRequests(user)) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700"><b>Access denied.</b> The Requests dashboard is for {REQUEST_REVIEW_ROLES.join(" / ")}.</div>;
  const r = getAppRequest(Number((await params).id));
  if (!r) notFound();
  const { pull, checks, stage, error } = await loadRequestState(r);
  const st = STAGES[stage];
  const files = pull ? await pullFiles(pull.number).catch(() => []) : [];
  const specPath = files.find((f) => /^src\/apps\/[^/]+\/SPEC\.md$/.test(f));
  const slug = specPath?.split("/")[2] ?? files.find((f) => f.startsWith("src/apps/") && f.split("/").length > 3)?.split("/")[2];
  const spec = pull && specPath ? await fileAt(specPath, pull.headRef) : null;
  const videos = pull && !pull.draft ? (await journeyVideos(pull.headSha).catch(() => null))?.filter((v) => !slug || v.app === slug) ?? null : null;
  const current = STEPS.findIndex((s) => s.stages.includes(stage));
  const by = getUser(r.requestedBy);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/requests" className="link text-xs">← All requests</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
          <span className={`badge ${TONE_CLS[st.tone]}`}>{st.label}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {by.name} ({by.title}) · {r.input.team} · {relative(r.ts)}
          {r.sessionUrl && <> · <a className="link" href={r.sessionUrl}>Devin session ↗</a></>}
          {pull && <> · <a className="link" href={pull.url}>PR #{pull.number} ↗</a></>}
          {checks?.url && <> · <a className="link" href={checks.url}>CI: {checks.state} ↗</a></>}
        </p>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>

      <ol className="card flex flex-wrap gap-2 p-3 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li key={s.label} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${i === current ? "bg-brand-50 text-brand-700 ring-1 ring-brand-600/20" : i < current ? "text-emerald-700" : "text-slate-400"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < current ? "bg-emerald-100" : i === current ? "bg-brand-100" : "bg-slate-100"}`}>{i < current ? "✓" : i + 1}</span>{s.label}
          </li>
        ))}
      </ol>

      {stage === "spec_review" && (
        <section className="card border-l-4 border-l-amber-400 p-4">
          <h2 className="card-title">Your review: spec and tests</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">Nothing is built yet. Check the assumptions and tests below.</p>
          <SpecReview id={r.id} />
        </section>
      )}
      {stage === "changes_requested" && <section className="card p-4 text-sm text-slate-600">Changes requested by {getUser(r.specDecisionBy ?? "").name}. Devin is revising the spec; it comes back here for review.</section>}
      {stage === "building" && <section className="card p-4 text-sm text-slate-600">Spec approved by {getUser(r.specDecisionBy ?? "").name}. Devin is building the app; when it marks the PR ready, CI runs every scenario and records each journey.</section>}
      {stage === "ready_to_ship" && (
        <section className="card border-l-4 border-l-emerald-500 p-4">
          <h2 className="card-title">Ready to ship</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">All tests passed. Watch the journey videos, then push to production (merges PR #{pull!.number}).</p>
          <ShipButton id={r.id} allowed={canShip(user)} why={`Only ${SHIP_ROLES.join(" / ")} can push to production`} />
        </section>
      )}
      {stage === "live" && <section className="card p-4 text-sm text-emerald-700">Live: PR #{pull!.number} is merged{r.shippedBy ? ` (pushed by ${getUser(r.shippedBy).name})` : ""}.</section>}

      {videos && (
        <section>
          <h2 className="eyebrow mb-2">Journey videos ({videos.filter((v) => v.ok).length}/{videos.length} passed)</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {videos.map((v) => (
              <figure key={v.video} className="card overflow-hidden">
                <JourneyVideo src={`/api/journey-videos/${pull!.headSha}/${encodeURIComponent(v.video)}`} />
                <figcaption className="flex items-start gap-2 p-3 text-sm">
                  <span className={`badge ${TONE_CLS[v.ok ? "good" : "bad"]}`}>{v.ok ? "passed" : "failed"}</span>
                  <span className="text-slate-700">{v.journey}{v.error && <span className="block text-xs text-rose-600">{v.error}</span>}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {pull && !pull.draft && !videos && <p className="text-sm text-slate-500">Journey videos appear here once CI finishes on the latest commit.</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="eyebrow mb-2">Spec</h2>
          <div className="card p-5">
            {spec ? <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{spec}</ReactMarkdown></div>
              : <p className="text-sm text-slate-400">{pull ? "No SPEC.md on the PR yet." : "Devin is drafting the spec."}</p>}
          </div>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Original request</h2>
          <dl className="card space-y-3 p-4 text-sm">
            {FORM.map(([k, label]) => (
              <div key={k}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="whitespace-pre-wrap text-slate-800">{Array.isArray(r.input[k]) ? (r.input[k] as string[]).join(", ") || "—" : String(r.input[k] || "—")}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
