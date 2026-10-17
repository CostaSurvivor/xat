import "server-only";
import { db } from "@/lib/db";
import { todayBR } from "@/lib/trips";
import { STAT_FIELDS, dailySeries, summarize, type StatField } from "@/lib/stats";

/** Soma 1 na estatística de hoje (nunca derruba a ação que chamou). */
export async function bumpStat(userId: string, field: StatField) {
  try {
    const day = todayBR();
    await db.profileStat.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, [field]: 1 }, update: { [field]: { increment: 1 } } });
  } catch (e) {
    console.error("bumpStat", e);
  }
}

/** Últimos 30 dias de cada estatística + resumo. */
export async function statsFor(userId: string) {
  const today = todayBR();
  const first = dailySeries([], today, 30)[0].day;
  const rows = await db.profileStat.findMany({ where: { userId, day: { gte: first } } });
  return (Object.keys(STAT_FIELDS) as StatField[]).map((f) => {
    const series = dailySeries(rows.map((r) => ({ day: r.day, value: r[f] })), today, 30);
    return { field: f, label: STAT_FIELDS[f], series, ...summarize(series) };
  });
}
