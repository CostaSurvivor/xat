import Link from "next/link";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { WELCOME } from "@/lib/welcome";

type Offer = { left: number; coins: number; vipDays: number; value: string | null };

/** Faixa da promoção de lançamento (some quando acabam as vagas). */
export function WelcomePromo({ offer, cta = true }: { offer: Offer; cta?: boolean }) {
  if (offer.left <= 0) return null;
  const used = WELCOME.slots - offer.left;
  return (
    <section aria-label="Promoção de lançamento" data-testid="promo" className="rounded-2xl border border-gold/40 bg-gradient-to-br from-amber-50 to-pink-50 p-5 text-left shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-wine">🎁 Promoção de lançamento</p>
      <h2 className="mt-1 text-xl font-bold leading-snug text-fg sm:text-2xl">
        Os {WELCOME.slots} primeiros perfis verificados ganham {offer.coins} {CURRENCY_ICON} {CURRENCY_NAME}
        {offer.value && <span className="text-wine"> (equivale a {offer.value})</span>} + {offer.vipDays} dias de VIP
      </h2>
      <p className="mt-1 text-sm text-fg/70">Para usar o site livremente: vídeos, presentes, destaques e recursos de assinante. Crie a conta, envie a selfie de verificação e o bônus cai assim que ela for aprovada.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={WELCOME.slots} aria-valuenow={used} aria-label="Vagas usadas">
          <div className="h-full rounded-full bg-wine" style={{ width: `${Math.max(4, (used / WELCOME.slots) * 100)}%` }} />
        </div>
        <span className="text-sm font-semibold text-wine">{offer.left === 1 ? "Resta 1 vaga!" : `Restam ${offer.left} vagas`}</span>
        {cta && <Link href="/cadastro" className="btn-gold">Quero o meu bônus</Link>}
      </div>
    </section>
  );
}
