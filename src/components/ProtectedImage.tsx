"use client";

import { useState } from "react";

/** Foto sem menu de contexto/arrastar; borrada até clicar quando `reveal`. */
export function ProtectedImage({ id, reveal = false, className = "", onReveal, bust }: { id: string; reveal?: boolean; className?: string; onReveal?: () => Promise<void> | void; bust?: string }) {
  const [shown, setShown] = useState(!reveal);
  const [loading, setLoading] = useState(false);
  const src = `/api/media/${id}?v=${shown ? "d" : "b"}${bust ? `&k=${bust}` : ""}`;
  return (
    <div className={`relative select-none overflow-hidden bg-black ${className}`} onContextMenu={(e) => e.preventDefault()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="protected-img pointer-events-none h-full w-full object-contain" loading="lazy" />
      <div className="absolute inset-0" />
      {!shown && (
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            await onReveal?.();
            setShown(true);
            setLoading(false);
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30 text-sm text-white"
        >
          <span className="text-2xl">👁️</span>
          {loading ? "Abrindo…" : "Toque para ver"}
        </button>
      )}
    </div>
  );
}
