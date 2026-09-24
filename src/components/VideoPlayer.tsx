"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Player de vídeo para assinantes: sem botão de download, sem PiP, sem menu,
 * com marca d'água flutuante do nick de QUEM ASSISTE (desestimula gravação de tela).
 * Não assinantes veem só a capa borrada + convite para assinar.
 */
export function VideoPlayer({ id, canWatch, viewerNick, className = "" }: { id: string; canWatch: boolean; viewerNick: string; className?: string }) {
  const [pos, setPos] = useState({ x: 10, y: 10 });
  useEffect(() => {
    if (!canWatch) return;
    const t = setInterval(() => setPos({ x: 5 + Math.random() * 55, y: 5 + Math.random() * 80 }), 4000);
    return () => clearInterval(t);
  }, [canWatch]);

  if (!canWatch)
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${id}?v=b`} alt="" draggable={false} className="protected-img h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 p-4 text-center">
          <span className="text-4xl">🔒▶</span>
          <p className="font-semibold">Vídeo exclusivo para assinantes</p>
          <Link href="/assinar" className="btn-gold">⭐ Assinar e assistir</Link>
        </div>
      </div>
    );

  return (
    <div className={`relative overflow-hidden bg-black ${className}`} onContextMenu={(e) => e.preventDefault()}>
      <video
        src={`/api/media/${id}?v=v`}
        poster={`/api/media/${id}?v=d`}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        className="h-full w-full object-contain"
      />
      <span
        className="pointer-events-none absolute select-none text-xs font-semibold text-white/35 transition-all duration-1000"
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, textShadow: "0 0 2px #000" }}
      >
        @{viewerNick}
      </span>
    </div>
  );
}
