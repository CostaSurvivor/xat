import "server-only";
import { db } from "@/lib/db";
import { canSeeStory, shouldRecordView, trayOrder } from "@/lib/stories";
import { blockedIds } from "@/server/access";
import { isVerified } from "@/server/auth";
import { friendIds } from "@/server/friends";
import { stylesFor } from "@/server/styles";

type Viewer = { id: string; role: string; state: string | null; ageVerification: string };

const authorSelect = { id: true, nick: true, avatarId: true, status: true, state: true, hideFromUnverified: true } as const;

/** Bandeja do feed: eu, amigos e quem eu sigo; mais perfis do meu estado com story aberto a todos. */
export async function storyTray(viewer: Viewer) {
  const [friends, following, blocked] = await Promise.all([
    friendIds(viewer.id),
    db.follow.findMany({ where: { followerId: viewer.id }, select: { followeeId: true } }),
    blockedIds(viewer.id),
  ]);
  const friendSet = new Set(friends);
  const close = new Set([viewer.id, ...friends, ...following.map((f) => f.followeeId)]);
  const blockedSet = new Set(blocked);
  const stories = await db.story.findMany({
    // só quem interessa: eu, amigos e quem sigo, ou perfis do meu estado com story aberto a todos
    where: {
      deletedAt: null,
      expiresAt: { gt: new Date() },
      author: { status: "ACTIVE" },
      authorId: { notIn: blocked },
      OR: [{ authorId: { in: [...close] } }, ...(viewer.state ? [{ audience: "ALL", author: { state: viewer.state } }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    include: { author: { select: authorSelect }, views: { where: { viewerId: viewer.id }, select: { viewerId: true } } },
  });
  const byAuthor = new Map<string, { author: (typeof stories)[number]["author"]; count: number; unseen: boolean; latest: number }>();
  for (const s of stories) {
    const a = s.author;
    if (!close.has(a.id) && (a.state !== viewer.state || s.audience !== "ALL")) continue;
    if (a.id !== viewer.id && a.hideFromUnverified && !isVerified(viewer)) continue;
    if (!canSeeStory(s, viewer, { friends: friendSet.has(a.id), blocked: blockedSet.has(a.id) })) continue;
    const cur = byAuthor.get(a.id) ?? { author: a, count: 0, unseen: false, latest: 0 };
    cur.count++;
    cur.unseen ||= a.id !== viewer.id && s.views.length === 0;
    cur.latest = Math.max(cur.latest, s.createdAt.getTime());
    byAuthor.set(a.id, cur);
  }
  const items = trayOrder([...byAuthor.values()].map((v) => ({ ...v, authorId: v.author.id })), viewer.id).slice(0, 30);
  const styles = await stylesFor(items.map((i) => i.authorId));
  return items.map((i) => ({ ...i, style: styles[i.authorId] }));
}

/** Stories no ar de um perfil que o viewer pode ver (mais antigo primeiro, como no Instagram). */
export async function storiesOf(authorId: string, viewer: Viewer) {
  const [friends, blocked] = await Promise.all([
    viewer.id === authorId ? Promise.resolve(true) : import("@/server/friends").then((m) => m.areFriends(viewer.id, authorId)),
    viewer.id === authorId ? Promise.resolve(false) : import("@/server/access").then((m) => m.isBlockedBetween(viewer.id, authorId)),
  ]);
  const list = await db.story.findMany({
    where: { authorId, deletedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    include: { views: { where: { viewerId: viewer.id }, select: { viewerId: true } }, _count: { select: { views: true } } },
  });
  return list.filter((s) => canSeeStory({ ...s, authorId }, viewer, { friends, blocked }));
}

/** Registra que viu (silencioso). */
export async function recordStoryView(viewer: { id: string; role: string }, storyId: string) {
  try {
    const s = await db.story.findUnique({ where: { id: storyId } });
    if (!s) return;
    // só registra quem de fato pode ver este story (ativo, sem bloqueio, amigos se for "só amigos")
    const [friends, blocked] = await Promise.all([
      s.audience === "FRIENDS" ? import("@/server/friends").then((m) => m.areFriends(viewer.id, s.authorId)) : Promise.resolve(false),
      import("@/server/access").then((m) => m.isBlockedBetween(viewer.id, s.authorId)),
    ]);
    if (!canSeeStory(s, viewer, { friends, blocked })) return;
    const invisible = !!(await stylesFor([viewer.id]))[viewer.id]?.powers.includes("INVISIBLE");
    if (!shouldRecordView({ viewerId: viewer.id, authorId: s.authorId, viewerRole: viewer.role, invisible })) return;
    await db.storyView.upsert({ where: { storyId_viewerId: { storyId, viewerId: viewer.id } }, create: { storyId, viewerId: viewer.id }, update: {} });
  } catch {}
}

/** Quem viu um story (só para o autor): sem bloqueados e sem contas removidas. */
export async function storyViewers(storyId: string, ownerId: string) {
  const views = await db.storyView.findMany({ where: { storyId }, orderBy: { viewedAt: "desc" }, take: 300 });
  const blocked = new Set(await blockedIds(ownerId));
  const users = await db.user.findMany({ where: { id: { in: views.map((v) => v.viewerId) }, status: "ACTIVE" }, select: { id: true, nick: true, avatarId: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return views.flatMap((v) => {
    const u = byId.get(v.viewerId);
    return u && !blocked.has(u.id) ? [{ ...u, viewedAt: v.viewedAt }] : [];
  });
}

/** Expurgo: stories vencidos/apagados há mais de 7 dias perdem a foto (a não ser que haja denúncia aberta). */
export async function purgeOldStories() {
  const { STORIES } = await import("@/lib/stories");
  const { storage } = await import("@/server/storage");
  const cut = new Date(Date.now() - STORIES.keepDays * 86400_000);
  const old = await db.story.findMany({ where: { OR: [{ expiresAt: { lt: cut } }, { deletedAt: { lt: cut } }] }, take: 200 });
  if (!old.length) return 0;
  const reported = new Set(
    (await db.report.findMany({ where: { status: "OPEN", targetType: "MEDIA", targetId: { in: old.map((s) => s.mediaId) } }, select: { targetId: true } })).map((r) => r.targetId),
  );
  const gone = old.filter((s) => !reported.has(s.mediaId));
  const media = await db.media.findMany({ where: { id: { in: gone.map((s) => s.mediaId) }, kind: "STORY" } });
  for (const m of media) await Promise.all([storage.remove(m.originalKey), storage.remove(m.displayKey), storage.remove(m.blurKey)]).catch(() => {});
  await db.story.deleteMany({ where: { id: { in: gone.map((s) => s.id) } } });
  await db.media.deleteMany({ where: { id: { in: media.map((m) => m.id) } } });
  return gone.length;
}
