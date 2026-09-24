import "server-only";
import { db } from "@/lib/db";
import { VISITS, shouldRecordVisit, visitIncrement } from "@/lib/visits";
import { isBlockedBetween } from "@/server/access";
import { stylesFor } from "@/server/styles";

/** Registra a visita de `viewer` ao perfil de `targetId` (silencioso: nunca quebra a página). */
export async function recordVisit(viewer: { id: string; role: string }, targetId: string) {
  try {
    const invisible = !!(await stylesFor([viewer.id]))[viewer.id]?.powers.includes("INVISIBLE");
    const blocked = await isBlockedBetween(viewer.id, targetId);
    if (!shouldRecordVisit({ viewerId: viewer.id, targetId, viewerRole: viewer.role, invisible, blocked })) return;
    const key = { visitedId_visitorId: { visitedId: targetId, visitorId: viewer.id } };
    const cur = await db.profileVisit.findUnique({ where: key, select: { lastAt: true } });
    const inc = visitIncrement(cur?.lastAt ?? null);
    await db.profileVisit.upsert({
      where: key,
      create: { visitedId: targetId, visitorId: viewer.id },
      update: { lastAt: new Date(), count: { increment: inc } },
    });
  } catch {}
}

/** Visitas recebidas na janela (sem quem foi bloqueado depois, sem contas removidas). */
export async function visitsFor(userId: string) {
  const since = new Date(Date.now() - VISITS.windowDays * 86400_000);
  const rows = await db.profileVisit.findMany({ where: { visitedId: userId, lastAt: { gt: since } }, orderBy: { lastAt: "desc" }, take: 200 });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.visitorId) }, status: "ACTIVE" },
    select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true },
  });
  const { blockedIds } = await import("@/server/access");
  const blocked = new Set(await blockedIds(userId));
  const byId = new Map(users.map((u) => [u.id, u]));
  const styles = await stylesFor(users.map((u) => u.id));
  return rows.flatMap((r) => {
    const u = byId.get(r.visitorId);
    if (!u || blocked.has(u.id)) return [];
    return [{ ...u, style: styles[u.id], count: r.count, lastAt: r.lastAt }];
  });
}

export async function visitCountSince(userId: string, days: number) {
  return db.profileVisit.count({ where: { visitedId: userId, lastAt: { gt: new Date(Date.now() - days * 86400_000) } } });
}
