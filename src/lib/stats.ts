/** Estatísticas do perfil: contas puras (testadas em tests/stats.test.ts). */
import { addDays } from "@/lib/trips";

export const STAT_FIELDS = { visits: "Visitas", reactions: "Reações recebidas", comments: "Comentários recebidos" } as const;
export type StatField = keyof typeof STAT_FIELDS;

/** Série diária dos últimos `days` dias (inclui hoje), preenchendo os dias sem registro com 0. */
export function dailySeries(rows: { day: string; value: number }[], today: string, days: number) {
  const by = new Map(rows.map((r) => [r.day, r.value]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, value: by.get(day) ?? 0 };
  });
}

/** Hoje, 7 dias, 30 dias e a variação dos últimos 7 dias contra os 7 anteriores (null quando não dá para comparar). */
export function summarize(series30: { value: number }[]) {
  const n = series30.length;
  const sum = (a: { value: number }[]) => a.reduce((s, d) => s + d.value, 0);
  const last7 = sum(series30.slice(n - 7));
  const prev7 = sum(series30.slice(n - 14, n - 7));
  return {
    today: series30[n - 1]?.value ?? 0,
    d7: last7,
    d30: sum(series30),
    deltaPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null,
  };
}
