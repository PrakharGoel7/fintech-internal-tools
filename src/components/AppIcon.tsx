const COLORS: Record<string, string> = { compliance: "bg-violet-600", finance: "bg-emerald-600", engineering: "bg-sky-600", operations: "bg-amber-600" };

export function AppIcon({ app, size = "md" }: { app: { name: string; category: string }; size?: "md" | "lg" }) {
  const initials = app.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const dim = size === "lg" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm";
  return <span className={`grid flex-none place-items-center rounded-lg font-semibold text-white ${dim} ${COLORS[app.category] ?? "bg-slate-600"}`}>{initials}</span>;
}
