"use client";
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "info";
export function toast(message: string, kind: Kind = "info") {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; kind: Kind }[]>([]);
  useEffect(() => {
    const h = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, message, kind }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
    };
    window.addEventListener("app-toast", h);
    return () => window.removeEventListener("app-toast", h);
  }, []);
  const color = { success: "bg-emerald-600", error: "bg-rose-600", info: "bg-slate-900" };
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((i) => <div key={i.id} className={`${color[i.kind]} max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-pop ring-1 ring-white/10`}>{i.message}</div>)}
    </div>
  );
}
