"use client";
import { useEffect, useRef } from "react";

/** Journey video whose thumbnail is its last frame (the outcome); playing starts from the beginning. */
export function JourneyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const showingEnd = useRef(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const toEnd = () => {
      if (Number.isFinite(v.duration) && v.currentTime === 0 && v.paused) { showingEnd.current = true; v.currentTime = Math.max(0, v.duration - 1); }
    };
    if (v.readyState >= 1) toEnd(); else v.addEventListener("loadedmetadata", toEnd, { once: true });
    return () => v.removeEventListener("loadedmetadata", toEnd);
  }, [src]);
  return (
    <video
      ref={ref}
      controls
      preload="auto"
      className="w-full bg-slate-900"
      src={src}
      onPlay={(e) => { if (showingEnd.current) { showingEnd.current = false; e.currentTarget.currentTime = 0; } }}
    />
  );
}
