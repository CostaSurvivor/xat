"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dismissSuggestion } from "@/app/actions/suggestions";
import { PROFILE_TYPES } from "@/lib/config";
import { Avatar } from "./Avatar";

type S = { id: string; nick: string; avatarId: string | null; profileType: string; city: string | null; state: string | null; hideCity: boolean; ageVerification: string };

const LATER_KEY = "sugestoes-depois";

/** "Sugestões para você": cards com ✕ (dispensa o perfil) e "Talvez mais tarde" (esconde a faixa por 3 dias). */
export function Suggestions({ items }: { items: S[] }) {
  const [list, setList] = useState(items);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(LATER_KEY) || 0);
      if (until > Date.now()) setHidden(true);
    } catch {}
  }, []);
  if (hidden || list.length === 0) return null;
  return (
    <section className="card min-w-0 max-w-full overflow-hidden p-3" aria-label="Sugestões para você" data-testid="sugestoes">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">✨ Sugestões para você</h2>
        <button type="button" className="text-xs text-mute underline" onClick={() => { try { localStorage.setItem(LATER_KEY, String(Date.now() + 3 * 86_400_000)); } catch {} setHidden(true); }}>Talvez mais tarde</button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {list.map((u) => (
          <div key={u.id} className="relative w-32 shrink-0 rounded-xl border border-line bg-panel p-2 text-center" data-testid="sugestao">
            <button type="button" aria-label={`Dispensar @${u.nick}`} className="absolute right-1 top-1 rounded-full px-1.5 text-xs text-mute hover:bg-panel2 hover:text-wine"
              onClick={() => { setList((l) => l.filter((x) => x.id !== u.id)); void dismissSuggestion(u.id); }}>✕</button>
            <Link href={`/u/${encodeURIComponent(u.nick)}`} className="flex flex-col items-center gap-1">
              <Avatar mediaId={u.avatarId} nick={u.nick} size={64} />
              <span className="w-full truncate text-xs font-semibold">{u.nick}{u.ageVerification === "APPROVED" && <span className="ml-0.5 text-gold">✔</span>}</span>
              <span className="w-full truncate text-[10px] text-mute">{PROFILE_TYPES[u.profileType as keyof typeof PROFILE_TYPES]?.label}</span>
              <span className="w-full truncate text-[10px] text-mute">{!u.hideCity && u.city ? `${u.city}/` : ""}{u.state}</span>
              <span className="mt-1 w-full rounded-lg bg-wine py-1 text-[11px] font-semibold text-white">Ver perfil</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
