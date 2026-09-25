import Link from "next/link";
import { CURRENCY_ICON } from "@/lib/config";
import { DAILY_REWARDS, cycleDay, nextStreak } from "@/lib/daily";
import { todayBR } from "@/lib/trips";
import { isVerified, type CurrentUser } from "@/server/auth";
import { DailyClaimButton } from "./DailyClaimButton";

/** Cartão "Presença diária" no feed: 7 dias, o 7º vale mais. */
export function DailyCard({ user }: { user: CurrentUser }) {
  const today = todayBR();
  const n = nextStreak(user.streakLastDay, user.streakDays, today);
  // dia destacado: o que vai pegar agora, ou o que já pegou hoje
  const current = n.canClaim ? n.dayInCycle : cycleDay(user.streakDays);
  const tomorrow = n.canClaim ? null : DAILY_REWARDS[cycleDay(user.streakDays + 1) - 1];
  return (
    <section className="card p-4" aria-label="Presença diária" data-testid="diaria">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto font-semibold">🔥 Presença diária</h2>
        {user.streakDays > 1 && !n.canClaim && <span className="text-xs text-mute">{user.streakDays} dias seguidos</span>}
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {DAILY_REWARDS.map((r, i) => {
          const day = i + 1;
          const done = day < current || (!n.canClaim && day === current);
          const now = n.canClaim && day === current;
          return (
            <li key={day} className={`rounded-lg border py-1.5 ${now ? "border-wine bg-pink-50 font-semibold text-wine" : done ? "border-transparent bg-wine/10 text-wine" : "border-line text-mute"} ${day === 7 ? "font-bold" : ""}`}>
              <div>{done ? "✓" : `Dia ${day}`}</div>
              <div>{r}{CURRENCY_ICON}</div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3">
        {!isVerified(user) ? (
          <p className="text-sm text-mute"><Link href="/verificacao" className="text-wine underline">Verifique seu perfil</Link> para ganhar Pimentas todo dia (e 50 {CURRENCY_ICON} no 7º dia).</p>
        ) : n.canClaim ? (
          <DailyClaimButton reward={n.reward} />
        ) : (
          <p role="status" className="text-sm text-mute">
            ✅ <b className="text-wine">+{DAILY_REWARDS[current - 1]} {CURRENCY_ICON}</b> de hoje já estão na sua carteira! Amanhã vale <b className="text-wine">{tomorrow} {CURRENCY_ICON}</b>. Se pular um dia, a sequência recomeça.
          </p>
        )}
      </div>
    </section>
  );
}
