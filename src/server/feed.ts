import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "./auth";
import { blockedIds } from "./access";
import { stylesFor } from "./styles";

export type FeedTab = "todos" | "seguindo" | "regiao";

export async function getFeed(viewer: CurrentUser, opts: { tab?: FeedTab; before?: string; authorId?: string; take?: number; ids?: string[]; groupId?: string }) {
  const take = opts.take ?? 15;
  const blocked = await blockedIds(viewer.id);
  const following = (await db.follow.findMany({ where: { followerId: viewer.id }, select: { followeeId: true } })).map((f) => f.followeeId);
  const { friendIds } = await import("./friends");
  const friends = await friendIds(viewer.id);

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    authorId: { notIn: blocked },
    author: { status: "ACTIVE" },
    OR: [
      { visibility: "PUBLIC" },
      { authorId: viewer.id },
      { visibility: "FRIENDS", authorId: { in: friends } },
      { visibility: "FOLLOWERS", authorId: { in: following } },
    ],
  };
  // posts de grupo só aparecem no grupo (ou pelo link, para quem pode ver o grupo)
  const { isCouple } = await import("@/lib/config");
  const groupScope: Prisma.PostWhereInput = opts.groupId
    ? { groupId: opts.groupId }
    : opts.ids
      ? { OR: [{ groupId: null }, { group: { archivedAt: null, audience: isCouple(viewer.profileType) || viewer.role !== "USER" ? { in: ["ALL", "COUPLES"] } : "ALL" } }] }
      : { groupId: null };
  where.AND = [groupScope];
  // posts específicos (página do post, destaques): mesmas regras de visibilidade e bloqueio
  if (opts.ids) where.AND.push({ id: { in: opts.ids } });
  else if (!opts.groupId) {
    if (opts.authorId) where.AND.push({ authorId: opts.authorId });
    else if (opts.tab === "seguindo") where.AND.push({ authorId: { in: [...following, viewer.id] } });
    else if (opts.tab === "regiao" && viewer.state) where.AND.push({ author: { state: viewer.state } });
  }
  if (opts.before) where.createdAt = { lt: new Date(opts.before) };

  const include = {
      author: { select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true, vipUntil: true } },
      media: { orderBy: { position: "asc" }, include: { media: { select: { id: true, status: true, width: true, height: true, kind: true } } } },
      _count: { select: { comments: { where: { deletedAt: null } } } },
  } as const;
  // Prioridade: na 1ª página de "Todos", posts recentes (72h) de quem eu sigo vêm primeiro
  const prioritized =
    !opts.before && !opts.authorId && !opts.ids && !opts.groupId && (opts.tab ?? "todos") === "todos" && following.length
      ? await db.post.findMany({
          where: { AND: [where, { authorId: { in: following } }, { createdAt: { gt: new Date(Date.now() - 72 * 3600_000) } }] },
          orderBy: { createdAt: "desc" },
          take: 8,
          include,
        })
      : [];
  const rest = await db.post.findMany({
    where: prioritized.length ? { AND: [where, { id: { notIn: prioritized.map((p) => p.id) } }] } : where,
    orderBy: { createdAt: "desc" },
    take,
    include,
  });
  const posts = [...prioritized, ...rest];
  const followedSet = new Set(prioritized.map((p) => p.id));
  const ids = posts.map((p) => p.id);
  const [reactions, mine] = await Promise.all([
    db.postReaction.groupBy({ by: ["postId", "emoji"], where: { postId: { in: ids } }, _count: true }),
    db.postReaction.findMany({ where: { postId: { in: ids }, userId: viewer.id } }),
  ]);
  const styles = await stylesFor(posts.map((p) => p.authorId));

  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    createdAt: p.createdAt.toISOString(),
    visibility: p.visibility,
    author: { ...p.author, vipUntil: undefined, vip: !!p.author.vipUntil && p.author.vipUntil > new Date(), city: p.author.hideCity ? null : p.author.city, style: styles[p.authorId] },
    media: p.media.filter((m) => m.media.status === "APPROVED").map((m) => ({ id: m.media.id, w: m.media.width, h: m.media.height, video: m.media.kind === "POST_VIDEO" })),
    comments: p._count.comments,
    reactions: Object.fromEntries(reactions.filter((r) => r.postId === p.id).map((r) => [r.emoji, r._count])),
    myReaction: mine.find((m) => m.postId === p.id)?.emoji ?? null,
    canDelete: p.authorId === viewer.id || viewer.role !== "USER",
    fromFollowed: followedSet.has(p.id),
  }));
}
export type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

export async function getComments(viewerId: string, postId: string) {
  const blocked = await blockedIds(viewerId);
  const rows = await db.postComment.findMany({
    where: { postId, deletedAt: null, authorId: { notIn: blocked } },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { author: { select: { id: true, nick: true, avatarId: true } }, post: { select: { authorId: true } } },
  });
  const ids = rows.map((r) => r.id);
  const [styles, reactions, mine] = await Promise.all([
    stylesFor(rows.map((r) => r.authorId)),
    db.commentReaction.groupBy({ by: ["commentId", "emoji"], where: { commentId: { in: ids } }, _count: true }),
    db.commentReaction.findMany({ where: { commentId: { in: ids }, userId: viewerId } }),
  ]);
  const view = (c: (typeof rows)[number]) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: { ...c.author, style: styles[c.authorId] },
    canDelete: c.authorId === viewerId || c.post.authorId === viewerId,
    reactions: Object.fromEntries(reactions.filter((r) => r.commentId === c.id).map((r) => [r.emoji, r._count])) as Record<string, number>,
    myReaction: mine.find((m) => m.commentId === c.id)?.emoji ?? null,
  });
  const roots = rows.filter((r) => !r.parentId || !rows.some((x) => x.id === r.parentId));
  return roots.map((r) => ({ ...view(r), replies: rows.filter((x) => x.parentId === r.id).map(view) }));
}

/**
 * Pode ler/interagir com o post? Reaproveita as regras do feed (visibilidade, bloqueio, grupo).
 * Escrever (comentar/reagir) em post de grupo exige ser membro do grupo.
 */
export async function canAccessPost(viewer: CurrentUser, postId: string, write = false) {
  const [post] = await getFeed(viewer, { ids: [postId], take: 1 });
  if (!post) return false;
  if (write) {
    const p = await db.post.findUnique({ where: { id: postId }, select: { groupId: true } });
    if (p?.groupId && viewer.role === "USER") {
      const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: p.groupId, userId: viewer.id } } });
      if (!m) return false;
    }
  }
  return true;
}
