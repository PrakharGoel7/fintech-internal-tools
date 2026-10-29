const COLORS: Record<string, string> = {
  compliance: "from-violet-500 to-violet-700 ring-violet-700/20",
  finance: "from-emerald-500 to-emerald-700 ring-emerald-700/20",
  engineering: "from-sky-500 to-sky-700 ring-sky-700/20",
  operations: "from-amber-400 to-amber-600 ring-amber-700/20",
};

export function AppIcon({ app, size = "md" }: { app: { name: string; category: string }; size?: "md" | "lg" }) {
  const initials = app.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const dim = size === "lg" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm";
  return <span className={`grid flex-none place-items-center rounded-xl bg-linear-to-br font-semibold tracking-tight text-white shadow-sm ring-1 ${dim} ${COLORS[app.category] ?? "from-slate-500 to-slate-700 ring-slate-700/20"}`}>{initials}</span>;
}
