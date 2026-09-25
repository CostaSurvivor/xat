import "server-only";
import { db } from "@/lib/db";
import { evaluate } from "@/lib/achievements";
import { friendIds } from "@/server/friends";

/** Conquistas de um perfil, calculadas na hora (contagens simples). */
export async function achievementsOf(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { ageVerification: true, createdAt: true } });
  if (!u) return [];
  const [posts, friends, followers, contos, invites, daily, events, testimonials] = await Promise.all([
    db.post.count({ where: { authorId: userId, deletedAt: null } }),
    friendIds(userId).then((f) => f.length),
    db.follow.count({ where: { followeeId: userId } }),
    db.conto.count({ where: { authorId: userId, deletedAt: null } }),
    db.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
    db.ledgerTransaction.count({ where: { idempotencyKey: { startsWith: `daily:${userId}:` } } }),
    db.eventRsvp.count({ where: { userId, status: "GOING" } }),
    db.testimonial.count({ where: { profileId: userId, status: "APPROVED", withdrawnAt: null } }),
  ]);
  return evaluate({
    verified: u.ageVerification === "APPROVED",
    posts,
    friends,
    followers,
    contos,
    invites,
    streak: daily,
    events,
    testimonials,
    ageDays: Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000),
  });
}
