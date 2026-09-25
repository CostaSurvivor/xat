"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextStreak } from "@/lib/daily";
import { todayBR } from "@/lib/trips";
import { isVerified, requireUser } from "@/server/auth";
import { grantReward } from "@/server/ledger";

/** Pega as Pimentas do dia (só perfis verificados; uma vez por dia, com trava). */
export async function claimDaily(): Promise<{ ok: boolean; reward?: number; days?: number; error?: string }> {
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para ganhar Pimentas todo dia." };
  const today = todayBR();
  const n = nextStreak(user.streakLastDay, user.streakDays, today);
  if (!n.canClaim) return { ok: false, error: "Você já pegou as Pimentas de hoje. Volte amanhã!" };
  // trava otimista: só grava se ninguém pegou entre a leitura e agora (dois cliques não pagam duas vezes)
  const r = await db.user.updateMany({
    where: { id: user.id, streakDays: user.streakDays, streakLastDay: user.streakLastDay },
    data: { streakDays: n.days, streakLastDay: today },
  });
  if (!r.count) return { ok: false, error: "Você já pegou as Pimentas de hoje. Volte amanhã!" };
  await grantReward(user.id, n.reward, `daily:${user.id}:${today}`, `🔥 Presença diária (dia ${n.dayInCycle} de 7)`);
  revalidatePath("/feed");
  return { ok: true, reward: n.reward, days: n.days };
}
