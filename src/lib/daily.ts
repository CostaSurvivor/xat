/** Presença diária: regras puras (testadas em tests/daily.test.ts). */
import { addDays } from "@/lib/trips";

/** Pimentas de cada dia da sequência (recomeça depois do 7º). */
export const DAILY_REWARDS = [5, 5, 10, 10, 15, 15, 50] as const;

/**
 * Próximo passo da sequência. `last` e `today` em "AAAA-MM-DD" (horário de Brasília).
 * Mesmo dia: já pegou. Dia seguinte: continua. Pulou: volta para o 1º dia.
 */
export function nextStreak(last: string | null, days: number, today: string) {
  if (last === today) return { canClaim: false, days, dayInCycle: cycleDay(days), reward: 0 };
  const newDays = last && addDays(last, 1) === today ? days + 1 : 1;
  const dayInCycle = cycleDay(newDays);
  return { canClaim: true, days: newDays, dayInCycle, reward: DAILY_REWARDS[dayInCycle - 1] };
}

export function cycleDay(days: number) {
  return days <= 0 ? 0 : ((days - 1) % DAILY_REWARDS.length) + 1;
}
