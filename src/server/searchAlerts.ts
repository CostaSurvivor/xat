import "server-only";
import { db } from "@/lib/db";
import { ALERTS, alertLabel, matchesAlert, nextSent, type AlertFilters } from "@/lib/searchAlerts";
import { todayBR } from "@/lib/trips";
import { blockedIds } from "@/server/access";
import { notify } from "@/server/notify";

export const toFilters = (a: { tipo: string | null; uf: string | null; raio: number | null; curte: string | null; foto: boolean }): AlertFilters => ({ tipo: a.tipo, uf: a.uf, raio: a.raio, curte: a.curte, foto: a.foto });

/**
 * Um perfil acabou de ser verificado: avisa quem tem alerta que combina.
 * Respeita bloqueios, "esconder de não verificados" e o limite diário de cada alerta.
 */
export async function runSearchAlerts(newUserId: string) {
  const c = await db.user.findUnique({ where: { id: newUserId } });
  if (!c || c.status !== "ACTIVE" || c.ageVerification !== "APPROVED") return 0;
  const blocked = new Set(await blockedIds(c.id));
  const alerts = await db.searchAlert.findMany({
    where: { userId: { not: c.id }, OR: [{ uf: null }, { uf: c.state ?? "--" }], user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, lat: true, lng: true, ageVerification: true } } },
    take: 2000,
  });
  const today = todayBR();
  const notified = new Set<string>();
  let sent = 0;
  for (const a of alerts) {
    if (notified.has(a.userId) || blocked.has(a.userId)) continue;
    if (c.hideFromUnverified && a.user.ageVerification !== "APPROVED") continue;
    if (!matchesAlert(toFilters(a), c, a.user)) continue;
    const next = nextSent(a, today);
    if (!next) continue;
    // trava: só avisa se o contador não mudou desde a leitura (duas aprovações ao mesmo tempo não estouram o limite)
    const r = await db.searchAlert.updateMany({ where: { id: a.id, sentDay: a.sentDay, sentCount: a.sentCount }, data: next });
    if (!r.count) continue;
    notified.add(a.userId);
    sent++;
    await notify(a.userId, "SEARCH_ALERT", `🔔 Novo perfil verificado na sua busca “${alertLabel(toFilters(a))}”: @${c.nick}`, c.id, a.id);
  }
  return sent;
}

export async function myAlerts(userId: string) {
  const rows = await db.searchAlert.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: ALERTS.max });
  return rows.map((a) => ({ id: a.id, filters: toFilters(a), label: alertLabel(toFilters(a)) }));
}
