"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction } from "@/app/server-actions";
import { toast } from "@/components/Toaster";

export function CommentBox({ appSlug, source, recordId }: { appSlug: string; source: string; recordId: string }) {
  const [body, setBody] = useState("");
  const router = useRouter();
  return (
    <form className="mt-3 flex gap-2" onSubmit={async (e) => {
      e.preventDefault();
      const r = await addCommentAction({ appSlug, source, recordId, body });
      if (!r.ok) return toast(r.message, "error");
      setBody(""); router.refresh();
    }}>
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      <button disabled={!body.trim()} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Post</button>
    </form>
  );
}
