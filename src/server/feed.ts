import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "./auth";
import { blockedIds } from "./access";
import { stylesFor } from "./styles";

export type FeedTab = "todos" | "seguindo" | "regiao";

export async function getFeed(viewer: CurrentUser, opts: { tab?: FeedTab; before?: string; authorId?: string; take?: number }) {
  const take = opts.take ?? 15;
  const blocked = await blockedIds(viewer.id);
  const following = (await db.follow.findMany({ where: { followerId: viewer.id }, select: { followeeId: true } })).map((f) => f.followeeId);

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    authorId: { notIn: blocked },
    author: { status: "ACTIVE" },
    OR: [{ visibility: "PUBLIC" }, { authorId: { in: [...following, viewer.id] } }],
  };
  if (opts.authorId) where.AND = [{ authorId: opts.authorId }];
  else if (opts.tab === "seguindo") where.AND = [{ authorId: { in: [...following, viewer.id] } }];
  else if (opts.tab === "regiao" && viewer.state) where.AND = [{ author: { state: viewer.state } }];
  if (opts.before) where.createdAt = { lt: new Date(opts.before) };

  const posts = await db.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true } },
      media: { orderBy: { position: "asc" }, include: { media: { select: { id: true, status: true, width: true, height: true } } } },
      _count: { select: { comments: { where: { deletedAt: null } } } },
    },
  });
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
    author: { ...p.author, city: p.author.hideCity ? null : p.author.city, style: styles[p.authorId] },
    media: p.media.filter((m) => m.media.status === "APPROVED").map((m) => ({ id: m.media.id, w: m.media.width, h: m.media.height })),
    comments: p._count.comments,
    reactions: Object.fromEntries(reactions.filter((r) => r.postId === p.id).map((r) => [r.emoji, r._count])),
    myReaction: mine.find((m) => m.postId === p.id)?.emoji ?? null,
    canDelete: p.authorId === viewer.id || viewer.role !== "USER",
  }));
}
export type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

export async function getComments(viewerId: string, postId: string) {
  const blocked = await blockedIds(viewerId);
  const rows = await db.postComment.findMany({
    where: { postId, deletedAt: null, authorId: { notIn: blocked } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { author: { select: { id: true, nick: true, avatarId: true } }, post: { select: { authorId: true } } },
  });
  const styles = await stylesFor(rows.map((r) => r.authorId));
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: { ...c.author, style: styles[c.authorId] },
    canDelete: c.authorId === viewerId || c.post.authorId === viewerId,
  }));
}
