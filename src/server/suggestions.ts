import "server-only";
import { db } from "@/lib/db";
import { pickSuggestions } from "@/lib/suggestions";
import { isVerified, type CurrentUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";

/** Perfis para sugerir: ativos, com foto ou verificados, sem bloqueio, que ainda não são amigos/seguidos nem foram dispensados. */
export async function suggestionsFor(user: CurrentUser, take = 8) {
  const [blocked, dismissed, following, friends] = await Promise.all([
    blockedIds(user.id),
    db.suggestionDismiss.findMany({ where: { userId: user.id }, select: { targetId: true } }),
    db.follow.findMany({ where: { followerId: user.id }, select: { followeeId: true } }),
    import("./friends").then((f) => f.friendIds(user.id)),
  ]);
  const exclude = [user.id, ...blocked, ...dismissed.map((d) => d.targetId), ...following.map((f) => f.followeeId), ...friends];
  const rows = await db.user.findMany({
    where: {
      id: { notIn: exclude },
      status: "ACTIVE",
      OR: [{ avatarId: { not: null } }, { ageVerification: "APPROVED" }],
      ...(isVerified(user) ? {} : { hideFromUnverified: false }),
    },
    orderBy: { lastSeenAt: "desc" },
    take: 300,
    select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, likes: true, ageVerification: true, lastSeenAt: true, createdAt: true },
  });
  const picked = pickSuggestions(user, rows, take);
  const styles = await stylesFor(picked.map((p) => p.id));
  return picked.map((p) => ({ ...p, style: styles[p.id] }));
}
