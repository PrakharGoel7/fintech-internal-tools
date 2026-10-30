import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { requestStage, buildDevinPrompt, type AppRequest } from "@/platform/requests";
import { unzip } from "@/platform/zip";
import { USERS } from "@/platform";
import type { Pull } from "@/platform/github";

const req = (o: Partial<AppRequest> = {}): AppRequest => ({ id: 1, ts: "", requestedBy: "carol", title: "T", input: {} as AppRequest["input"], status: "devin_started", ref: "req-1", sessionUrl: "https://app.devin.ai/sessions/abc", issueUrl: null, specDecision: null, specDecisionSha: null, specDecisionBy: null, shippedBy: null, ...o });
const pr = (o: Partial<Pull> = {}): Pull => ({ number: 5, url: "", title: "", draft: true, open: true, merged: false, headRef: "app-request/req-1-x", headSha: "a", ...o });

describe("request stages", () => {
  it("no PR yet → Devin is drafting", () => expect(requestStage(req(), null, null)).toBe("drafting"));
  it("draft PR → spec waits for an engineer", () => expect(requestStage(req(), pr(), null)).toBe("spec_review"));
  it("changes requested → waits for Devin until it pushes a new commit", () => {
    const r = req({ specDecision: "changes_requested", specDecisionSha: "a" });
    expect(requestStage(r, pr(), null)).toBe("changes_requested");
    expect(requestStage(r, pr({ headSha: "b" }), null)).toBe("spec_review");
  });
  it("approved, still draft → building", () => expect(requestStage(req({ specDecision: "approved" }), pr(), null)).toBe("building"));
  it("ready PR follows CI", () => {
    const r = req({ specDecision: "approved" });
    expect(requestStage(r, pr({ draft: false }), { state: "pending" })).toBe("testing");
    expect(requestStage(r, pr({ draft: false }), { state: "failure" })).toBe("checks_failing");
    expect(requestStage(r, pr({ draft: false }), { state: "success" })).toBe("ready_to_ship");
  });
  it("merged → live", () => expect(requestStage(req(), pr({ merged: true, open: false }), null)).toBe("live"));
});

it("the prompt carries the request ref and never asks the requester questions", () => {
  const p = buildDevinPrompt({ title: "X", team: "ops", users: "", problem: "", data: "", actions: "", approvals: "", sensitive: [], urgency: "" }, USERS[0], "o/r", "req-abc");
  expect(p).toContain("App-Request: req-abc");
  expect(p).toContain("do not ask them questions");
});

it("unzip reads stored and deflated entries", () => {
  const entries = [{ name: "a.txt", data: Buffer.from("hello"), method: 0 }, { name: "dir/b.json", data: Buffer.from('{"ok":true}'), method: 8 }];
  const locals: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.method === 8 ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(e.method, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(e.method, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, body); central.push(ch, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  const out = unzip(Buffer.concat([...locals, cd, eocd]));
  expect(out.map((f) => [f.name, f.data.toString()])).toEqual([["a.txt", "hello"], ["dir/b.json", '{"ok":true}']]);
});
