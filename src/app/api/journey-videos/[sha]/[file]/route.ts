import fs from "node:fs";
import { getCurrentUser } from "@/app/session";
import { canReviewRequests } from "@/platform/requests";
import { journeyVideoPath } from "@/platform/github";

/** Serves a cached CI journey video (with Range support so the player can seek). */
export async function GET(req: Request, { params }: { params: Promise<{ sha: string; file: string }> }) {
  if (!canReviewRequests(await getCurrentUser())) return new Response("Forbidden", { status: 403 });
  const { sha, file } = await params;
  const p = journeyVideoPath(sha, decodeURIComponent(file));
  if (!p) return new Response("Not found", { status: 404 });
  const size = fs.statSync(p).size;
  const m = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400" };
  if (!m) return new Response(fs.readFileSync(p), { headers: { ...headers, "Content-Length": String(size) } });
  const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return new Response(fs.readFileSync(p).subarray(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
}
