import Link from "next/link";
import { CURRENCY_ICON } from "@/lib/config";
import { ONBOARDING_REWARD, STEPS } from "@/lib/onboarding";
import { onboardingState } from "@/server/onboarding";
import { claimOnboarding, hideOnboarding } from "@/app/actions/onboarding";
import { ClaimButton } from "./OnboardingClaim";

type U = { id: string; ageVerification: string; avatarId: string | null; bio: string | null; likes: unknown; onboardingHiddenAt: Date | null };

/** Cartão "Primeiros passos" no feed: some quando a pessoa esconde ou resgata o bônus. */
export async function OnboardingCard({ user }: { user: U }) {
  if (user.onboardingHiddenAt) return null;
  const st = await onboardingState(user);
  if (st.claimed) return null;
  const { done, total, pct, complete } = st.progress;
  return (
    <section className="card space-y-3 border-wine/30 p-4" aria-label="Primeiros passos">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto font-semibold">🚀 Primeiros passos <span className="text-sm font-normal text-mute">· {done} de {total}</span></h2>
        <form action={hideOnboarding}><button className="text-xs text-mute hover:underline" aria-label="Esconder primeiros passos">esconder</button></form>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-wine2" style={{ width: `${pct}%` }} />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.key}>
            {st.done[s.key] ? (
              <span className="flex items-center gap-2 text-sm text-mute line-through"><span className="text-green-600 no-underline">✓</span> {s.label}</span>
            ) : (
              <Link href={s.href} className="flex items-center gap-2 text-sm hover:text-wine"><span className="text-mute">○</span> {s.label} →</Link>
            )}
          </li>
        ))}
      </ul>
      {complete ? (
        <ClaimButton action={claimOnboarding} label={`🎁 Resgatar ${CURRENCY_ICON} ${ONBOARDING_REWARD} de bônus`} />
      ) : (
        <p className="text-xs text-mute">Complete tudo e ganhe <b className="text-gold">{CURRENCY_ICON} {ONBOARDING_REWARD}</b> de bônus para usar na loja.</p>
      )}
    </section>
  );
}
