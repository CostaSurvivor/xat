import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { isStaff, isVerified } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { friendIds } from "@/server/friends";
import { stylesFor } from "@/server/styles";

export type NetworkTab = "amigos" | "seguidores" | "seguindo";
export const NETWORK_TABS: NetworkTab[] = ["amigos", "seguidores", "seguindo"];

type Viewer = Pick<User, "id" | "role" | "ageVerification">;

/** Amigos / seguidores / seguindo de um perfil, só com quem o visitante pode ver (ativos, sem bloqueio, respeitando "esconder de não verificados"). */
export async function networkOf(viewer: Viewer, userId: string, tab: NetworkTab, take = 60) {
  const ids =
    tab === "amigos"
      ? await friendIds(userId)
      : tab === "seguidores"
        ? (await db.follow.findMany({ where: { followeeId: userId }, orderBy: { createdAt: "desc" }, take: 1000, select: { followerId: true } })).map((f) => f.followerId)
        : (await db.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: "desc" }, take: 1000, select: { followeeId: true } })).map((f) => f.followeeId);
  if (!ids.length) return { total: 0, users: [] };
  const blocked = new Set(await blockedIds(viewer.id));
  const users = await db.user.findMany({
    where: {
      id: { in: ids.filter((id) => !blocked.has(id)) },
      status: "ACTIVE",
      ...(isVerified(viewer) || isStaff(viewer) ? {} : { OR: [{ hideFromUnverified: false }, { id: viewer.id }] }),
    },
    select: { id: true, nick: true, avatarId: true, profileType: true, lastSeenAt: true, ageVerification: true },
  });
  // mantém a ordem (mais recentes primeiro) da lista original
  const pos = new Map(ids.map((id, i) => [id, i]));
  users.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  const shown = users.slice(0, take);
  const styles = await stylesFor(shown.map((u) => u.id));
  return { total: users.length, users: shown.map((u) => ({ ...u, style: styles[u.id] })) };
}
