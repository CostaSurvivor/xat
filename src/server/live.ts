import "server-only";
import { db } from "@/lib/db";
import { LIVE, isStale, splitTip } from "@/lib/live";
import { isBlockedBetween, blockedIds } from "@/server/access";
import { isStaff, isSubscriber, isVerified, type CurrentUser } from "@/server/auth";
import { postTransaction, runLedger, systemWallet, userWallet } from "@/server/ledger";
import { stylesFor } from "@/server/styles";

let lastSweep = 0;
/** Encerra transmissões sem heartbeat e apaga sinais velhos (no máx. a cada 10 s). */
export async function sweepLive() {
  if (Date.now() - lastSweep < 10_000) return;
  lastSweep = Date.now();
  const cutoff = new Date(Date.now() - LIVE.staleMs);
  const stale = await db.liveStream.findMany({ where: { status: "LIVE", lastBeatAt: { lt: cutoff } }, select: { id: true } });
  for (const s of stale) await endLive(s.id, "Conexão de quem transmitia caiu");
  await db.liveSignal.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3 * 60_000) } } });
}

export async function liveById(id: string) {
  return db.liveStream.findUnique({
    where: { id },
    include: { host: { select: { id: true, nick: true, avatarId: true, role: true, status: true, vipUntil: true, ageVerification: true } } },
  });
}
export type LiveWithHost = NonNullable<Awaited<ReturnType<typeof liveById>>>;

/** null = pode assistir; senão, o motivo. */
export async function watchDenied(user: CurrentUser, live: LiveWithHost): Promise<string | null> {
  if (user.id === live.hostId || isStaff(user)) return null;
  if (live.host.status !== "ACTIVE") return "Transmissão indisponível.";
  if (await isBlockedBetween(user.id, live.hostId)) return "Transmissão indisponível.";
  if (await db.liveBan.findUnique({ where: { streamId_userId: { streamId: live.id, userId: user.id } } })) return "Você foi removido desta transmissão.";
  if (live.audience === "VIP" && !isSubscriber(user)) return "Esta transmissão é só para assinantes.";
  return null;
}

export function canBroadcast(user: CurrentUser): string | null {
  if (!isVerified(user)) return "Verifique seu perfil (selfie) para transmitir ao vivo.";
  if (process.env.LIVE_REQUIRE_SUBSCRIBER === "1" && !isSubscriber(user)) return "Transmitir ao vivo é exclusivo para assinantes.";
  return null;
}

export async function startLive(user: CurrentUser, data: { title: string; audience: "ALL" | "VIP"; tipGoal: number | null; goalLabel: string | null }) {
  // uma transmissão por vez
  const open = await db.liveStream.findMany({ where: { hostId: user.id, status: "LIVE" }, select: { id: true } });
  for (const o of open) await endLive(o.id, "Nova transmissão iniciada");
  const live = await db.liveStream.create({ data: { hostId: user.id, ...data } });
  await db.liveMessage.create({ data: { streamId: live.id, kind: "SYSTEM", body: "Transmissão iniciada. Seja respeitoso: gravar, printar ou divulgar é proibido." } });
  // avisa seguidores e amigos (sem quem bloqueou)
  const [followers, friends, blocked] = await Promise.all([
    db.follow.findMany({ where: { followeeId: user.id }, select: { followerId: true }, take: 2000 }),
    db.friendship.findMany({ where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] }, select: { requesterId: true, addresseeId: true }, take: 2000 }),
    blockedIds(user.id),
  ]);
  const ids = new Set<string>([...followers.map((f) => f.followerId), ...friends.map((f) => (f.requesterId === user.id ? f.addresseeId : f.requesterId))]);
  for (const b of blocked) ids.delete(b);
  ids.delete(user.id);
  if (ids.size)
    await db.notification.createMany({
      data: [...ids].map((userId) => ({ userId, kind: "LIVE" as const, actorId: user.id, refId: live.id, text: `🔴 @${user.nick} está ao vivo: ${data.title}`.slice(0, 255) })),
    });
  return live;
}

export async function endLive(id: string, reason: string) {
  const r = await db.liveStream.updateMany({ where: { id, status: "LIVE" }, data: { status: "ENDED", endedAt: new Date(), endReason: reason.slice(0, 120) } });
  if (r.count) {
    await db.liveMessage.create({ data: { streamId: id, kind: "SYSTEM", body: `Transmissão encerrada. ${reason}`.slice(0, 500) } });
    await db.liveSignal.deleteMany({ where: { streamId: id } });
  }
  return r.count > 0;
}

/**
 * Gorjeta: tira de quem dá, credita quem transmite (menos a taxa, se houver),
 * soma no total/meta e aparece animada no chat. Tudo numa transação.
 */
export async function tipLive(fromId: string, live: { id: string; hostId: string }, amount: number, message: string, key: string) {
  if (fromId === live.hostId) throw new Error("Não dá para dar gorjeta para si mesmo");
  const { host, fee } = splitTip(amount);
  return runLedger(async (tx) => {
    const cur = await tx.liveStream.findUniqueOrThrow({ where: { id: live.id }, select: { status: true } });
    if (cur.status !== "LIVE") throw new Error("A transmissão já terminou");
    const a = await userWallet(tx, fromId);
    const b = await userWallet(tx, live.hostId);
    const moves = [
      { walletId: a.id, amount: -amount },
      { walletId: b.id, amount: host },
    ];
    if (fee > 0) moves.push({ walletId: (await systemWallet(tx, "SYSTEM_SINK")).id, amount: fee });
    const r = await postTransaction(tx, { type: "TIP", key, moves, note: `live:${live.id}`, actorId: fromId });
    if (!r.created) return false;
    await tx.liveStream.update({ where: { id: live.id }, data: { tipTotal: { increment: amount } } });
    await tx.liveViewer.upsert({
      where: { streamId_userId: { streamId: live.id, userId: fromId } },
      create: { streamId: live.id, userId: fromId, tipped: amount },
      update: { tipped: { increment: amount } },
    });
    await tx.liveMessage.create({ data: { streamId: live.id, authorId: fromId, kind: "TIP", amount, body: message.slice(0, 140) } });
    return true;
  });
}

/** Marca presença; devolve true se quem transmite (heartbeat). */
export async function touchLive(live: LiveWithHost, userId: string) {
  const now = new Date();
  if (userId === live.hostId) {
    await db.liveStream.update({ where: { id: live.id }, data: { lastBeatAt: now } });
    return;
  }
  await db.liveViewer.upsert({
    where: { streamId_userId: { streamId: live.id, userId } },
    create: { streamId: live.id, userId },
    update: { lastSeenAt: now },
  });
}

export async function viewersOf(streamId: string) {
  const rows = await db.liveViewer.findMany({
    where: { streamId, lastSeenAt: { gt: new Date(Date.now() - LIVE.viewerWindowMs) } },
    orderBy: { joinedAt: "asc" },
    take: 200,
    select: { userId: true },
  });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, nick: true, avatarId: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => byId.get(r.userId)).filter(Boolean) as { id: string; nick: string; avatarId: string | null }[];
}

export async function topTippers(streamId: string, take = 5) {
  const rows = await db.liveViewer.findMany({ where: { streamId, tipped: { gt: 0 } }, orderBy: { tipped: "desc" }, take, select: { userId: true, tipped: true } });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, nick: true } });
  const styles = await stylesFor(users.map((u) => u.id));
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => { const u = byId.get(r.userId); return u ? [{ id: u.id, nick: u.nick, total: r.tipped, style: styles[u.id] }] : []; });
}

export async function liveMessages(streamId: string, viewerId: string, after?: bigint) {
  const blocked = await blockedIds(viewerId);
  const rows = await db.liveMessage.findMany({
    where: { streamId, deletedAt: null, ...(after ? { id: { gt: after } } : {}), OR: [{ authorId: null }, { authorId: { notIn: blocked } }] },
    orderBy: { id: after ? "asc" : "desc" },
    take: 60,
    include: { author: { select: { id: true, nick: true, avatarId: true } } },
  });
  if (!after) rows.reverse();
  const styles = await stylesFor([...new Set(rows.map((r) => r.authorId).filter(Boolean) as string[])]);
  return rows.map((m) => ({
    id: m.id.toString(),
    kind: m.kind,
    body: m.body,
    amount: m.amount,
    createdAt: m.createdAt.toISOString(),
    author: m.author ? { id: m.author.id, nick: m.author.nick, avatarId: m.author.avatarId, style: styles[m.author.id] } : null,
  }));
}
export type LiveChatMessage = Awaited<ReturnType<typeof liveMessages>>[number];

export async function liveList() {
  await sweepLive();
  const lives = await db.liveStream.findMany({
    where: { status: "LIVE", lastBeatAt: { gt: new Date(Date.now() - LIVE.staleMs) } },
    orderBy: { startedAt: "desc" },
    take: 60,
    include: { host: { select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true } } },
  });
  const counts = await db.liveViewer.groupBy({ by: ["streamId"], where: { streamId: { in: lives.map((l) => l.id) }, lastSeenAt: { gt: new Date(Date.now() - LIVE.viewerWindowMs) } }, _count: true });
  const c = new Map(counts.map((x) => [x.streamId, x._count]));
  return lives.map((l) => ({ ...l, viewers: c.get(l.id) ?? 0 })).sort((a, b) => b.viewers - a.viewers);
}

export { isStale };

/** Contexto comum das rotas /api/live/[id]/*. */
export async function liveCtx(id: string) {
  const { getCurrentUser } = await import("@/server/auth");
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login", status: 401 } as const;
  const live = await liveById(id);
  if (!live) return { error: "Transmissão não encontrada", status: 404 } as const;
  const denied = await watchDenied(user, live);
  if (denied) return { error: denied, status: 403 } as const;
  return { user, live, isHost: user.id === live.hostId, canMod: user.id === live.hostId || isStaff(user) } as const;
}
