import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/platform/db";
import "@/connectors";
import { audit } from "@/platform/audit";

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

const inv = db.prepare(`INSERT INTO vendor_invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const vendors = ["Northwind Office Supply", "Contoso Cloud Hosting", "Fabrikam Facilities", "Acme Logistics", "Globex Consulting", "Initech Software", "Umbrella Catering", "Wayne Security Services", "Stark Hardware", "Tyrell Data Labs"];
const INVOICES = 36;
for (let i = 1; i <= INVOICES; i++) {
  const status = i <= 16 ? "pending_review" : i <= 20 ? "on_hold" : pick(["approved", "approved", "approved", "rejected"]);
  const amount = i % 5 === 0 ? int(25001, 90000) + pick([0, 0.5]) : i === 7 ? 25000 : int(180, 24000) + pick([0, 0.25, 0.99]);
  const created = daysAgo(int(0, 20), int(0, 23));
  const entered = pick(["maya", "leo"]);
  const approver = status === "approved" ? (amount > 25000 ? "erin" : entered === "maya" ? "leo" : "maya") : null;
  const due = new Date(Date.now() + int(-3, 30) * 86400000).toISOString().slice(0, 10);
  inv.run(`ven_${(52000000 + i * 7919).toString(36)}`, pick(vendors), `INV-${20260 + i * 13}`, amount, "USD", due,
    `${int(100000000, 999999999)}-${int(10000000, 99999999)}${int(1000, 9999)}`, status, entered, approver, created, created);
}

audit({ actor: "system", action: "platform.seeded", details: { kyc_cases: 48, refunds: 60, feature_flags: flags.length, vendor_invoices: INVOICES } });
console.log(`Seeded ${file}`);
