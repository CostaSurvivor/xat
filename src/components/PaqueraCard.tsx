"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { likeProfile, skipProfile } from "@/app/actions/paquera";

/** Botões Passar / Curtir; quando dá match, mostra o aviso com atalho para o PV. */
export function PaqueraActions({ targetId, nick }: { targetId: string; nick: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [match, setMatch] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const next = () => router.refresh();
  return (
    <>
      <div className="flex items-center justify-center gap-6">
        <button
          disabled={pending}
          onClick={() => start(async () => { await skipProfile(targetId); next(); })}
          aria-label={`Passar @${nick}`}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-line bg-white text-2xl text-mute shadow transition hover:scale-105"
        >✕</button>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await likeProfile(targetId);
              if (!r.ok) return setErr(r.error ?? "Erro");
              if (r.match) setMatch(r.nick ?? nick);
              else next();
            })
          }
          aria-label={`Curtir @${nick}`}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-wine2 text-3xl text-white shadow-lg transition hover:scale-105"
        >❤</button>
      </div>
      {err && <p className="text-center text-sm text-red-700">{err}</p>}
      {match && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-label="Deu match">
          <div className="card w-full max-w-sm space-y-4 p-6 text-center">
            <p className="text-5xl">💘</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Deu match!</h2>
            <p className="text-sm text-mute">Vocês e @{match} se curtiram. Que tal mandar um oi?</p>
            <div className="flex flex-col gap-2">
              <Link href={`/mensagens/${encodeURIComponent(match)}`} className="btn-gold">✉️ Mandar mensagem</Link>
              <button onClick={() => { setMatch(null); next(); }} className="btn-ghost">Continuar paquerando</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
