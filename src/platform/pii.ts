/** Server-side PII masking. Raw values never leave the server unless revealed (and audited). */
export function maskValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes("@")) {
    const [local, domain] = s.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "••••-••-••";
  if (s.length <= 4) return "•".repeat(s.length);
  return "•".repeat(Math.max(0, s.length - 2)) + s.slice(-2);
}

export function maskRow<T extends Record<string, unknown>>(row: T, piiFields: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const f of piiFields) if (f in out) out[f] = maskValue(out[f]);
  return out as T;
}
