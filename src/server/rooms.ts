import "server-only";
import type { Room } from "@prisma/client";
import { db } from "@/lib/db";
import { isCouple } from "@/lib/config";
import { onlineSortKey, type Actor, type RoomRoleName } from "@/lib/permissions";
import { isVerified, type CurrentUser } from "./auth";
import { blockedIds } from "./access";
import { stylesFor } from "./styles";

export const ONLINE_WINDOW_MS = 45_000;

export async function roomBySlug(slug: string) {
  return db.room.findUnique({ where: { slug: slug.toLowerCase() }, include: { owner: { select: { id: true, role: true, vipUntil: true, status: true } } } });
}

type RoomOwnerInfo = { isOfficial: boolean; owner: { role: string; vipUntil: Date | null; status: string } | null };

/**
 * Sala de usuário só fica ativa enquanto o dono é assinante (estilo xat).
 * Salas oficiais, da plataforma ou de staff ficam sempre ativas.
 */
export function roomIsActive(room: RoomOwnerInfo) {
  if (room.isOfficial || !room.owner) return true;
  if (room.owner.status !== "ACTIVE") return false;
  if (room.owner.role !== "USER") return true;
  return !!room.owner.vipUntil && room.owner.vipUntil > new Date();
}

export async function actorFor(user: { id: string; role: string }, roomId: string): Promise<Actor> {
  const m = await db.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } });
  return { role: (m?.role ?? "GUEST") as RoomRoleName, platformRole: user.role as Actor["platformRole"] };
}

export async function activeSanction(roomId: string, userId: string, type: "MUTE" | "BAN") {
  return db.roomSanction.findFirst({
    where: { roomId, userId, type, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
}

/** Pode entrar/ler a sala? Retorna motivo quando não. */
export async function canEnter(user: CurrentUser, room: Room & RoomOwnerInfo, actor: Actor): Promise<string | null> {
  if (actor.platformRole !== "USER") return null;
  if (!roomIsActive(room))
    return actor.role === "OWNER"
      ? "Sua sala está inativa porque a assinatura venceu. Renove para reabrir."
      : "Esta sala está inativa no momento.";
  if (await activeSanction(room.id, user.id, "BAN")) return "Você está banido desta sala.";
  if (room.access === "MEMBERS_ONLY" && actor.role === "GUEST") return "Sala exclusiva para membros.";
  if (room.access === "COUPLES_ONLY" && !isCouple(user.profileType) && actor.role === "GUEST") return "Sala exclusiva para casais.";
  if (room.access === "VERIFIED_ONLY" && !isVerified(user)) return "Sala exclusiva para perfis verificados.";
  return null;
}

export async function touchPresence(roomId: string, userId: string, typing: boolean) {
  const now = new Date();
  const prev = await db.roomPresence.findUnique({ where: { roomId_userId: { roomId, userId } } });
  await db.roomPresence.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: { roomId, userId, lastSeenAt: now, typingUntil: typing ? new Date(now.getTime() + 5000) : null },
    update: { lastSeenAt: now, typingUntil: typing ? new Date(now.getTime() + 5000) : null },
  });
  return !prev || now.getTime() - prev.lastSeenAt.getTime() > 2 * 60_000; // "acabou de entrar"
}

export async function onlineList(roomId: string, viewer: CurrentUser) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const rows = await db.roomPresence.findMany({
    where: { roomId, lastSeenAt: { gt: since } },
    include: { room: false },
  });
  const ids = rows.map((r) => r.userId);
  const [users, members, styles, blocked] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, nick: true, avatarId: true, profileType: true, ageVerification: true, role: true, statusText: true, city: true, state: true, hideCity: true } }),
    db.roomMember.findMany({ where: { roomId, userId: { in: ids } } }),
    stylesFor(ids),
    blockedIds(viewer.id),
  ]);
  const roleOf = new Map(members.map((m) => [m.userId, m.role as RoomRoleName]));
  const staffViewer = viewer.role !== "USER";
  const typingNow = new Date();
  const { chatRole, CHAT_ROLE_RANK } = await import("@/components/RoleIcon");
  const list = users
    .filter((u) => !blocked.includes(u.id))
    .filter((u) => u.id === viewer.id || staffViewer || !styles[u.id]?.powers.includes("INVISIBLE"))
    .map((u) => {
      const role = roleOf.get(u.id) ?? "GUEST";
      const st = styles[u.id];
      const p = rows.find((r) => r.userId === u.id)!;
      return {
        ...u,
        city: u.hideCity ? null : u.city,
        roomRole: role,
        style: st,
        invisible: st?.powers.includes("INVISIBLE") ?? false,
        highlight: st?.powers.includes("HIGHLIGHT_ONLINE") ?? false,
        typing: !!p.typingUntil && p.typingUntil > typingNow && u.id !== viewer.id,
        chatRole: chatRole(u.role, role, st?.founder),
        sort: CHAT_ROLE_RANK[chatRole(u.role, role, st?.founder)] * 10_000_000 + onlineSortKey(role, (st?.power ?? 0) % 1_000_000),
      };
    })
    .sort((a, b) => b.sort - a.sort || a.nick.localeCompare(b.nick));
  return list;
}
export type OnlineUser = Awaited<ReturnType<typeof onlineList>>[number];

export async function messagesView(roomId: string, viewerId: string, opts: { after?: bigint; before?: bigint; take?: number }) {
  const blocked = await blockedIds(viewerId);
  const take = opts.take ?? 50;
  const rows = await db.message.findMany({
    where: {
      roomId,
      deletedAt: null,
      mediaId: null, // chat é só texto (fotos antigas ficam ocultas)
      ...(opts.after ? { id: { gt: opts.after } } : opts.before ? { id: { lt: opts.before } } : {}),
      OR: [{ authorId: null }, { authorId: { notIn: blocked } }],
    },
    orderBy: { id: opts.after ? "asc" : "desc" },
    take,
    include: { author: { select: { id: true, nick: true, avatarId: true, role: true } } },
  });
  if (!opts.after) rows.reverse();
  const authorIds = [...new Set(rows.map((r) => r.authorId).filter(Boolean) as string[])];
  const [styles, memberRows] = await Promise.all([
    stylesFor(authorIds),
    db.roomMember.findMany({ where: { roomId, userId: { in: authorIds } }, select: { userId: true, role: true } }),
  ]);
  const { chatRole } = await import("@/components/RoleIcon");
  const roomRoleOf = new Map(memberRows.map((m) => [m.userId, m.role as string]));
  return rows.map((m) => ({
    id: m.id.toString(),
    kind: m.kind,
    body: m.body,
    mediaId: m.mediaId,
    createdAt: m.createdAt.toISOString(),
    author: m.author
      ? { id: m.author.id, nick: m.author.nick, avatarId: m.author.avatarId, style: styles[m.author.id], chatRole: chatRole(m.author.role, roomRoleOf.get(m.author.id), styles[m.author.id]?.founder) }
      : null,
  }));
}
export type ChatMessage = Awaited<ReturnType<typeof messagesView>>[number];

export async function roomOnlineCounts() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const g = await db.roomPresence.groupBy({ by: ["roomId"], where: { lastSeenAt: { gt: since } }, _count: true });
  return new Map(g.map((x) => [x.roomId, x._count]));
}

/** Membros da sala que estão offline (seção "Offline" da lista, estilo xat). */
export async function offlineMembers(roomId: string, onlineIds: string[], viewerId: string) {
  const blocked = await blockedIds(viewerId);
  const rows = await db.roomMember.findMany({
    where: { roomId, userId: { notIn: [...onlineIds, ...blocked] }, user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, nick: true, avatarId: true, role: true, statusText: true, profileType: true } } },
    take: 80,
  });
  const { chatRole, CHAT_ROLE_RANK } = await import("@/components/RoleIcon");
  const styles = await stylesFor(rows.map((r) => r.userId));
  return rows
    .map((r) => ({ ...r.user, style: styles[r.userId], chatRole: chatRole(r.user.role, r.role, styles[r.userId]?.founder) }))
    .filter((u) => !u.style?.powers.includes("INVISIBLE"))
    .sort((a, b) => CHAT_ROLE_RANK[b.chatRole] - CHAT_ROLE_RANK[a.chatRole] || a.nick.localeCompare(b.nick));
}
export type OfflineUser = Awaited<ReturnType<typeof offlineMembers>>[number];
