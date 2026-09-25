"use client";

import { useEffect, useState } from "react";
import { CURRENCY_ICON } from "@/lib/config";
import { INVITER_MILESTONES, INVITER_TIERS, REFERRAL, inviterReward } from "@/lib/referral";

/** Link de convite com botão de copiar/compartilhar (no próprio perfil). */
export function InviteCard({ nick, stats }: { nick: string; stats: { invited: number; verified: number; rewarded: number } }) {
  const [link, setLink] = useState(`/convite/${encodeURIComponent(nick)}`);
  const [copied, setCopied] = useState(false);
  const next = stats.rewarded + 1;
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
        Quando alguém entra pelo seu link e tem o perfil verificado, vocês <b>dois</b> ganham. E quanto mais você convida, <b>mais vale cada convite</b>:
      </p>
      <ol className="mt-2 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4" data-testid="escada">
        {INVITER_TIERS.map((t, i) => {
          const from = i === 0 ? 1 : INVITER_TIERS[i - 1].upTo + 1;
          const on = next >= from && next <= t.upTo;
          return (
            <li key={t.upTo} className={`rounded-lg border px-2 py-1.5 text-center ${on ? "border-wine bg-pink-50 font-semibold text-wine" : "border-line text-mute"}`}>
              {from}º–{t.upTo}º<br /><b>{t.coins} {CURRENCY_ICON}</b> cada
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-xs text-mute">
        🎁 Bônus: {Object.entries(INVITER_MILESTONES).map(([n, d]) => `${n}º convite = +${d} dias de VIP`).join(" · ")}. Quem é convidado ganha {REFERRAL.inviteeCoins} {CURRENCY_ICON}.
        {next <= REFERRAL.maxRewarded ? <> Seu próximo convite vale <b className="text-wine">{inviterReward(next).coins} {CURRENCY_ICON}</b>.</> : <> Você completou os {REFERRAL.maxRewarded} convites premiados! 🏆</>}
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
