import "server-only";
import type { Prisma, ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { PAQUERA, candidateOrder } from "@/lib/paquera";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";

type Viewer = { id: string; state: string | null };

const cardSelect = {
  id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, bio: true, likes: true, lastSeenAt: true,
  persons: { select: { label: true, birthDate: true } },
} as const;

/** Próximo perfil da Paquera (verificado, com foto, ainda não curtido/passado, sem bloqueio). */
export async function nextCandidate(viewer: Viewer, tipo?: string) {
  const [blocked, liked, skipped] = await Promise.all([
    blockedIds(viewer.id),
    db.profileLike.findMany({ where: { likerId: viewer.id }, select: { likedId: true } }),
    db.profileSkip.findMany({ where: { userId: viewer.id, createdAt: { gt: new Date(Date.now() - PAQUERA.skipDays * 86400_000) } }, select: { skippedId: true } }),
  ]);
  const exclude = [viewer.id, ...blocked, ...liked.map((l) => l.likedId), ...skipped.map((s) => s.skippedId)];
  const where: Prisma.UserWhereInput = { status: "ACTIVE", ageVerification: "APPROVED", avatarId: { not: null }, id: { notIn: exclude } };
  if (tipo === "CASAIS") where.profileType = { in: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] };
  else if (tipo) where.profileType = tipo as ProfileType;
  const rows = await db.user.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: 40, select: cardSelect });
  const pick = candidateOrder(rows, viewer.state)[0];
  if (!pick) return null;
  const likesMe = !!(await db.profileLike.findUnique({ where: { likerId_likedId: { likerId: pick.id, likedId: viewer.id } } }));
  return { ...pick, style: (await stylesFor([pick.id]))[pick.id], likesMe };
}

async function usersById(ids: string[], viewerId: string) {
  const blocked = new Set(await blockedIds(viewerId));
  const users = await db.user.findMany({ where: { id: { in: ids.filter((i) => !blocked.has(i)) }, status: "ACTIVE" }, select: cardSelect });
  const styles = await stylesFor(users.map((u) => u.id));
  return new Map(users.map((u) => [u.id, { ...u, style: styles[u.id] }]));
}

/** Quem curtiu você (mais recentes primeiro), marcando quem já virou match. */
export async function likesReceived(userId: string) {
  const rows = await db.profileLike.findMany({ where: { likedId: userId }, orderBy: { createdAt: "desc" }, take: 200 });
  const mine = new Set((await db.profileLike.findMany({ where: { likerId: userId, likedId: { in: rows.map((r) => r.likerId) } }, select: { likedId: true } })).map((r) => r.likedId));
  const users = await usersById(rows.map((r) => r.likerId), userId);
  return rows.flatMap((r) => {
    const u = users.get(r.likerId);
    return u ? [{ ...u, at: r.createdAt, match: mine.has(r.likerId) }] : [];
  });
}

/** Matches: curtidas recíprocas. */
export async function matchesOf(userId: string) {
  const mineRows = await db.profileLike.findMany({ where: { likerId: userId }, select: { likedId: true, createdAt: true } });
  const back = await db.profileLike.findMany({ where: { likedId: userId, likerId: { in: mineRows.map((r) => r.likedId) } }, select: { likerId: true, createdAt: true } });
  const when = new Map(back.map((b) => [b.likerId, b.createdAt]));
  const mineAt = new Map(mineRows.map((r) => [r.likedId, r.createdAt]));
  const users = await usersById(back.map((b) => b.likerId), userId);
  return back
    .flatMap((b) => {
      const u = users.get(b.likerId);
      const at = new Date(Math.max(when.get(b.likerId)!.getTime(), mineAt.get(b.likerId)!.getTime()));
      return u ? [{ ...u, at }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function likesReceivedCount(userId: string) {
  return db.profileLike.count({ where: { likedId: userId } });
}
