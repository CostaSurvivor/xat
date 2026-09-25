"use client";

import { useEffect, useState } from "react";
import { CURRENCY_ICON } from "@/lib/config";
import { REFERRAL } from "@/lib/referral";

/** Link de convite com botão de copiar/compartilhar (no próprio perfil). */
export function InviteCard({ nick, stats }: { nick: string; stats: { invited: number; verified: number; rewarded: number } }) {
  const [link, setLink] = useState(`/convite/${encodeURIComponent(nick)}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setLink(`${location.origin}/convite/${encodeURIComponent(nick)}`), [nick]);
  const share = async () => {
    const text = `Vem pro SexPapo! Entrando pelo meu convite você ganha ${REFERRAL.inviteeCoins} ${CURRENCY_ICON} quando verificar o perfil:`;
    try {
      if (navigator.share) return await navigator.share({ title: "SexPapo", text, url: link });
    } catch {}
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <section className="card p-4" aria-label="Convide amigos">
      <h2 className="font-semibold">📣 Convide amigos</h2>
      <p className="mt-1 text-sm text-mute">
        Quando alguém entra pelo seu link e tem o perfil verificado, vocês <b>dois</b> ganham {REFERRAL.inviterCoins} {CURRENCY_ICON}. Até {REFERRAL.maxRewarded} convites premiados.
      </p>
      <div className="mt-3 flex gap-2">
        <input readOnly value={link} aria-label="Seu link de convite" className="input min-w-0 flex-1 text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={share} className="btn-gold shrink-0">{copied ? "Copiado ✓" : "Compartilhar"}</button>
      </div>
      <p className="mt-2 text-xs text-mute" data-testid="convites">
        {stats.invited} {stats.invited === 1 ? "pessoa entrou" : "pessoas entraram"} pelo seu link · {stats.verified} {stats.verified === 1 ? "verificada" : "verificadas"} · {stats.rewarded} {stats.rewarded === 1 ? "prêmio" : "prêmios"}
      </p>
    </section>
  );
}
