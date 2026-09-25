import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { delta, fillDays } from "@/lib/report";

const REASON_PT: Record<string, string> = {
  POSSIBLE_MINOR: "Possível menor", NON_CONSENSUAL: "Sem consentimento", ILLEGAL_CONTENT: "Conteúdo ilegal", HARASSMENT: "Assédio", FAKE_PROFILE: "Perfil falso", SPAM: "Spam", OTHER: "Outro",
};

/** Série diária no horário de Brasília (UTC-3) a partir de uma consulta agregada. */
async function daily(table: "User" | "Payment" | "Message" | "LedgerTransaction", since: Date, value: Prisma.Sql, extra: Prisma.Sql = Prisma.empty, dateCol = "createdAt") {
  const col = Prisma.raw(`\`${dateCol}\``);
  const rows = await db.$queryRaw<{ day: string; value: bigint | number | string }[]>(
    Prisma.sql`SELECT DATE_FORMAT(CONVERT_TZ(${col}, '+00:00', '-03:00'), '%Y-%m-%d') AS day, ${value} AS value
               FROM ${Prisma.raw(`\`${table}\``)} WHERE ${col} >= ${since} ${extra} GROUP BY day`,
  );
  return rows.map((r) => ({ day: String(r.day), value: Number(r.value) }));
}

export async function adminReport(days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400_000);
  const prevSince = new Date(since.getTime() - days * 86400_000);
  const range = (from: Date, to: Date) => ({ gte: from, lt: to });

  const kpi = async (fn: (r: { gte: Date; lt: Date }) => Promise<number>) => {
    const [cur, prev] = await Promise.all([fn(range(since, now)), fn(range(prevSince, since))]);
    return { value: cur, prev, delta: delta(cur, prev) };
  };
  const revenue = (r: { gte: Date; lt: Date }) => db.payment.aggregate({ where: { status: "PAID", reviewedAt: r }, _sum: { amountCents: true } }).then((a) => a._sum.amountCents ?? 0);

  const [signups, verified, revenueCents, messages, reports, activeNow] = await Promise.all([
    kpi((r) => db.user.count({ where: { createdAt: r } })),
    kpi((r) => db.verificationRequest.count({ where: { status: "APPROVED", reviewedAt: r } })),
    kpi(revenue),
    kpi((r) => db.message.count({ where: { createdAt: r, kind: "TEXT" } })),
    kpi((r) => db.report.count({ where: { createdAt: r } })),
    db.user.count({ where: { lastSeenAt: { gte: since }, status: "ACTIVE" } }),
  ]);

  const [dSignups, dRevenue, dMessages] = await Promise.all([
    daily("User", since, Prisma.sql`COUNT(*)`),
    daily("Payment", since, Prisma.sql`COALESCE(SUM(amountCents), 0)`, Prisma.sql`AND status = 'PAID'`, "reviewedAt"),
    daily("Message", since, Prisma.sql`COUNT(*)`, Prisma.sql`AND kind = 'TEXT'`),
  ]);

  // crescimento: convites premiados, presença diária, Pimentas de bônus e promoção de lançamento
  const [invites, dailyClaims, bonusCoins, promoUsed, dDaily, inviterRows] = await Promise.all([
    kpi((r) => db.user.count({ where: { referralRewardedAt: r } })),
    kpi((r) => db.ledgerTransaction.count({ where: { idempotencyKey: { startsWith: "daily:" }, createdAt: r } })),
    kpi((r) => db.ledgerEntry.aggregate({ where: { amount: { gt: 0 }, createdAt: r, transaction: { type: "REWARD" } }, _sum: { amount: true } }).then((a) => a._sum.amount ?? 0)),
    db.welcomeBonus.count(),
    daily("LedgerTransaction", since, Prisma.sql`COUNT(*)`, Prisma.sql`AND idempotencyKey LIKE 'daily:%'`),
    db.user.groupBy({ by: ["referredById"], where: { referralRewardedAt: { gte: since }, referredById: { not: null } }, _count: { _all: true }, orderBy: { _count: { referredById: "desc" } }, take: 8 }),
  ]);
  const inviters = await db.user.findMany({ where: { id: { in: inviterRows.map((r) => r.referredById!) } }, select: { id: true, nick: true } });

  const [roomRows, reasonRows, itemRows] = await Promise.all([
    db.message.groupBy({ by: ["roomId"], where: { createdAt: { gte: since }, kind: "TEXT" }, _count: { _all: true }, orderBy: { _count: { roomId: "desc" } }, take: 8 }),
    db.report.groupBy({ by: ["reason"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.inventoryItem.groupBy({ by: ["itemId"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { itemId: "desc" } }, take: 8 }),
  ]);
  const [rooms, items] = await Promise.all([
    db.room.findMany({ where: { id: { in: roomRows.map((r) => r.roomId) } }, select: { id: true, name: true } }),
    db.item.findMany({ where: { id: { in: itemRows.map((r) => r.itemId) } }, select: { id: true, name: true } }),
  ]);
  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "—";

  return {
    days,
    kpis: { signups, verified, revenueCents, messages, reports, activeNow },
    series: {
      signups: fillDays(dSignups, days, now),
      revenueCents: fillDays(dRevenue, days, now),
      messages: fillDays(dMessages, days, now),
    },
    topRooms: roomRows.map((r) => ({ label: nameOf(rooms, r.roomId), value: r._count._all })),
    reportsByReason: reasonRows.map((r) => ({ label: REASON_PT[r.reason] ?? r.reason, value: r._count._all })).sort((a, b) => b.value - a.value),
    topItems: itemRows.map((r) => ({ label: nameOf(items, r.itemId), value: r._count._all })),
    growth: {
      invites,
      dailyClaims,
      bonusCoins,
      promoUsed,
      dailySeries: fillDays(dDaily, days, now),
      topInviters: inviterRows.map((r) => ({ label: `@${inviters.find((u) => u.id === r.referredById)?.nick ?? "?"}`, value: r._count._all })),
    },
  };
}
