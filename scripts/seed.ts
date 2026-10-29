import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/platform/db";
import "@/connectors";
import { audit } from "@/platform/audit";
import { runAction, getUser } from "@/platform";
import { getApp } from "@/apps/registry";

/** Deterministic synthetic data. Never seed real customer data. */
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const int = (lo: number, hi: number) => Math.floor(rand() * (hi - lo + 1)) + lo;

const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db");
if (file !== ":memory:") for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
const db = getDb();

const first = ["Maya", "Liam", "Noah", "Emma", "Olivia", "Ava", "Lucas", "Mia", "Ethan", "Zoe", "Arjun", "Sofia", "Kenji", "Amara", "Diego", "Hannah", "Omar", "Ines", "Wei", "Leila"];
const last = ["Johnson", "Garcia", "Nguyen", "Smith", "Brown", "Martinez", "Kowalski", "Haddad", "Tanaka", "Okonkwo", "Rossi", "Singh", "Müller", "Silva", "Cohen", "Park"];
const name = () => `${pick(first)} ${pick(last)}`;
const email = (n: string) => `${n.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`;
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

const kyc = db.prepare(`INSERT INTO kyc_cases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (let i = 1; i <= 48; i++) {
  const n = name();
  const risk = int(5, 95);
  const status = i <= 30 ? "pending" : pick(["approved", "approved", "rejected", "escalated"]);
  const created = daysAgo(int(0, 4), int(0, 23));
  kyc.run(`KYC-${1000 + i}`, n, email(n), String(int(1000, 9999)), `19${int(60, 99)}-0${int(1, 9)}-1${int(0, 9)}`,
    pick(["US", "US", "US", "GB", "CA", "MX", "DE", "NG", "IN"]), pick(["passport", "drivers_license", "national_id"]),
    risk, risk > 70 ? "watchlist_hit" : risk > 40 ? "needs_review" : "clear", status,
    status === "pending" ? null : pick(["alice", "bob"]), created, created);
}

const ref = db.prepare(`INSERT INTO refunds VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const reasons = ["duplicate_charge", "service_outage", "fraudulent", "customer_request", "billing_error"];
for (let i = 1; i <= 60; i++) {
  const n = name();
  const status = i <= 18 ? "requested" : pick(["issued", "issued", "issued", "denied"]);
  const amount = rand() < 0.25 ? int(500, 4800) + 0.0 : int(5, 480) + pick([0, 0.5, 0.99]);
  const created = daysAgo(int(0, 29), int(0, 23));
  ref.run(`ref_${(7000 + i).toString(36)}`, `ch_${(900000 + i * 37).toString(36)}`, n, email(n), amount, "USD",
    pick(reasons), status, status === "issued" ? `re_${(5000 + i).toString(36)}` : null,
    pick(["sam", "sam", "alice"]), created, created);
}

const flags: [string, string, string, number, number, number, number][] = [
  ["new-onboarding-flow", "Redesigned signup + KYC capture", "growth", 1, 1, 0, 0],
  ["instant-payouts", "Same-day ACH payouts for verified merchants", "payments", 1, 1, 1, 25],
  ["card-controls-v2", "Per-merchant card spend controls", "cards", 1, 0, 0, 0],
  ["ml-fraud-score", "Use new ML model for fraud scoring", "risk", 1, 1, 0, 0],
  ["multi-currency-wallet", "Hold balances in EUR/GBP", "payments", 1, 0, 0, 0],
  ["dark-mode", "Dashboard dark mode", "web", 1, 1, 1, 100],
  ["statement-pdf-v3", "New monthly statement renderer", "platform", 1, 1, 0, 0],
  ["kyc-auto-approve-low-risk", "Auto-approve KYC with risk < 15", "risk", 1, 0, 0, 0],
];
const fl = db.prepare(`INSERT INTO feature_flags VALUES (?,?,?,?,?,?,?,?,?)`);
for (const f of flags) fl.run(...f, daysAgo(int(10, 90)), daysAgo(int(0, 9)));

const dsp = db.prepare(`INSERT INTO disputes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const disputeReasons = ["fraudulent", "product_not_received", "duplicate", "subscription_canceled", "unrecognized"];
/** Synthetic evidence windows; real windows vary by network and are set by Stripe's `evidence_details.due_by`. */
const evidenceWindowDays: Record<string, number> = { visa: 7, mastercard: 7, amex: 10, discover: 9 };
const DISPUTES = 40;
for (let i = 1; i <= DISPUTES; i++) {
  const n = name();
  const network = pick(["visa", "visa", "visa", "mastercard", "mastercard", "amex", "discover"]);
  const window = evidenceWindowDays[network];
  const status = i <= 18 ? "needs_response" : pick(["under_review", "under_review", "won", "won", "won", "lost", "lost", "accepted"]);
  const open = status === "needs_response";
  const amount = i % 4 === 0 || rand() < 0.15 ? int(1001, 6500) + pick([0, 0.5]) : int(15, 950) + pick([0, 0.99]);
  const createdMs = open ? Date.now() - (int(0, window - 1) * 24 + int(0, 22)) * 3600000 : Date.now() - int(window, 60) * 86400000;
  const created = new Date(createdMs).toISOString();
  dsp.run(`dp_${(46000000 + i * 7919).toString(36)}`, `ch_${(910000 + i * 53).toString(36)}`, n, email(n), amount, "USD",
    network, pick(disputeReasons), new Date(createdMs + window * 86400000).toISOString(), status,
    open ? (i <= 5 ? pick(["alice", "bob"]) : null) : pick(["alice", "alice", "bob"]),
    ["under_review", "won", "lost"].includes(status) ? `evs_${(80000 + i).toString(36)}` : null,
    status === "won" ? 100 : status === "lost" ? 0 : null, created, created);
}

const ACCOUNTS = 36;
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const acct = db.prepare(`INSERT INTO customer_accounts VALUES (?,?,?,?,?,?,?,?,?)`);
for (let i = 1; i <= ACCOUNTS; i++) {
  const n = name();
  const limit = pick([2500, 5000, 5000, 10000, 15000]);
  const status = i <= 8 ? "active" : i <= 11 ? "expired" : i <= 13 ? "rejected" : "none";
  const override = status === "none" || status === "rejected" ? null : i % 3 === 0 ? int(26, 60) * 1000 : limit + int(1, 10) * 1000;
  const expiry = status === "active" ? daysAhead(int(1, 30)) : status === "expired" ? daysAhead(-int(1, 40)) : null;
  const created = daysAgo(int(60, 900));
  acct.run(`acct_${100200 + i * 17}`, n, email(n), limit, override, expiry, status, created, daysAgo(int(0, 30)));
}

/** Two pending override requests filed through the real action pipeline (one needs Compliance). */
async function seedOverrideRequests() {
  const app = getApp("limit-overrides");
  const sam = getUser("sam");
  const ids = (db.prepare("SELECT id FROM customer_accounts WHERE override_status = 'none' ORDER BY id LIMIT 2").all() as { id: string }[]).map((r) => r.id);
  const requests: [number, string, string][] = [[18000, "property_closing", "Closing on a house Friday; title company wire."], [40000, "business_payment", "Quarterly supplier payment, invoice on file."]];
  for (const [i, [limit, reason, note]] of requests.entries())
    await runAction({ user: sam, app, actionId: "requestOverride", recordId: ids[i], reason, note, input: { override_limit: limit, override_expiry: daysAhead(7 + i * 7) } });
}

seedOverrideRequests().then(() => {
  audit({ actor: "system", action: "platform.seeded", details: { kyc_cases: 48, refunds: 60, feature_flags: flags.length, disputes: DISPUTES, customer_accounts: ACCOUNTS } });
  console.log(`Seeded ${file}`);
});
