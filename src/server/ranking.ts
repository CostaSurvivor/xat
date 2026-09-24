import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PROFILE_GROUPS, postScore, rankItems, type ProfileGroup } from "@/lib/ranking";
import type { CurrentUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { getFeed } from "@/server/feed";
import { stylesFor } from "@/server/styles";

type Row = { postId: string; authorId: string; createdAt: Date; reactions: number; commenters: number };

const cache = new Map<string, { at: number; rows: Row[] }>();
const TTL = 5 * 60_000;

/**
 * Pontos por post público da janela. Só contam reações de perfis verificados e ativos, sem a do
 * autor; comentários contam 1x por pessoa (verificada, não o autor). photosOnly: só posts com foto.
 */
async function scoredPosts(days: number, opts: { photosOnly: boolean; uf?: string }): Promise<Row[]> {
  const key = `${days}|${opts.photosOnly}|${opts.uf ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  const since = new Date(Date.now() - days * 86400_000);
  const uf = opts.uf ? Prisma.sql`AND a.state = ${opts.uf}` : Prisma.empty;
  const photo = opts.photosOnly
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM PostMedia pm JOIN Media m ON m.id = pm.mediaId WHERE pm.postId = p.id AND m.kind = 'POST' AND m.status = 'APPROVED')`
    : Prisma.empty;
  const base = Prisma.sql`p.createdAt > ${since} AND p.deletedAt IS NULL AND p.visibility = 'PUBLIC' AND p.groupId IS NULL AND a.status = 'ACTIVE' ${uf} ${photo}`;
  const [reacts, comms] = await Promise.all([
    db.$queryRaw<{ postId: string; authorId: string; createdAt: Date; n: bigint }[]>`
      SELECT p.id AS postId, p.authorId AS authorId, p.createdAt AS createdAt, COUNT(*) AS n
      FROM PostReaction r JOIN Post p ON p.id = r.postId JOIN User a ON a.id = p.authorId JOIN User u ON u.id = r.userId
      WHERE ${base} AND r.userId <> p.authorId AND u.ageVerification = 'APPROVED' AND u.status = 'ACTIVE'
      GROUP BY p.id, p.authorId, p.createdAt ORDER BY n DESC LIMIT 500`,
    db.$queryRaw<{ postId: string; authorId: string; createdAt: Date; n: bigint }[]>`
      SELECT p.id AS postId, p.authorId AS authorId, p.createdAt AS createdAt, COUNT(DISTINCT c.authorId) AS n
      FROM PostComment c JOIN Post p ON p.id = c.postId JOIN User a ON a.id = p.authorId JOIN User u ON u.id = c.authorId
      WHERE ${base} AND c.deletedAt IS NULL AND c.authorId <> p.authorId AND u.ageVerification = 'APPROVED' AND u.status = 'ACTIVE'
      GROUP BY p.id, p.authorId, p.createdAt ORDER BY n DESC LIMIT 500`,
  ]);
  const by = new Map<string, Row>();
  for (const r of reacts) by.set(r.postId, { postId: r.postId, authorId: r.authorId, createdAt: r.createdAt, reactions: Number(r.n), commenters: 0 });
  for (const c of comms) {
    const cur = by.get(c.postId) ?? { postId: c.postId, authorId: c.authorId, createdAt: c.createdAt, reactions: 0, commenters: 0 };
    cur.commenters = Number(c.n);
    by.set(c.postId, cur);
  }
  const rows = [...by.values()];
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

/** Fotos em alta, já com as regras de visibilidade/bloqueio do feed para quem está vendo. */
export async function topPhotos(viewer: CurrentUser, days: number, uf?: string, take = 30) {
  const ranked = rankItems((await scoredPosts(days, { photosOnly: true, uf })).map((r) => ({ ...r, score: postScore(r.reactions, r.commenters) }))).slice(0, 80);
  if (!ranked.length) return [];
  const posts = await getFeed(viewer, { ids: ranked.map((r) => r.postId), take: 80 });
  const byId = new Map(posts.map((p) => [p.id, p]));
  return ranked.flatMap((r) => {
    const p = byId.get(r.postId);
    return p && p.media.some((m) => !m.video) ? [{ post: p, score: r.score }] : [];
  }).slice(0, take);
}

/** Perfis mais curtidos da janela, por grupo (casais, mulheres…). */
export async function topProfiles(viewer: { id: string; ageVerification: string } | null, days: number, group: ProfileGroup, take = 30) {
  const rows = await scoredPosts(days, { photosOnly: false });
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.authorId, (totals.get(r.authorId) ?? 0) + postScore(r.reactions, r.commenters));
  const types = PROFILE_GROUPS[group].types as readonly string[];
  const blocked = viewer ? new Set(await blockedIds(viewer.id)) : new Set<string>();
  const viewerVerified = !viewer || viewer.ageVerification === "APPROVED";
  const users = await db.user.findMany({
    // só perfis verificados entram no ranking (evita perfil falso no topo)
    where: { id: { in: [...totals.keys()] }, status: "ACTIVE", ageVerification: "APPROVED", profileType: { in: [...types] as never } },
    select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true, hideFromUnverified: true },
  });
  const list = users
    .filter((u) => !blocked.has(u.id) && (viewerVerified || !u.hideFromUnverified))
    .map((u) => ({ ...u, score: totals.get(u.id) ?? 0, createdAt: new Date(0) }))
    .filter((u) => u.score > 0);
  const top = rankItems(list).sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick)).slice(0, take);
  const styles = await stylesFor(top.map((u) => u.id));
  return top.map((u) => ({ ...u, style: styles[u.id] }));
}

/** Posição no Top 10 da semana do grupo da pessoa (para o selo no perfil), ou null. */
export async function weeklyTopRank(user: { id: string; profileType: string }) {
  const group = (Object.keys(PROFILE_GROUPS) as ProfileGroup[]).find((g) => (PROFILE_GROUPS[g].types as readonly string[]).includes(user.profileType));
  if (!group) return null;
  const top = await topProfiles(null, 7, group, 10);
  const i = top.findIndex((u) => u.id === user.id);
  return i >= 0 ? { rank: i + 1, group: PROFILE_GROUPS[group].label } : null;
}
