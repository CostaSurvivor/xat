import "server-only";
import { db } from "@/lib/db";
import { progress, rewardKey, stepsDone } from "@/lib/onboarding";

export async function onboardingState(user: { id: string; ageVerification: string; avatarId: string | null; bio: string | null; likes: unknown }) {
  const [roomMessages, posts, pushDevices, claimed] = await Promise.all([
    db.message.count({ where: { authorId: user.id, kind: "TEXT" } }),
    db.post.count({ where: { authorId: user.id, deletedAt: null } }),
    db.pushSubscription.count({ where: { userId: user.id } }),
    db.ledgerTransaction.findUnique({ where: { idempotencyKey: rewardKey(user.id) }, select: { id: true } }),
  ]);
  const done = stepsDone({ verified: user.ageVerification === "APPROVED", hasAvatar: !!user.avatarId, bio: user.bio, likes: user.likes, roomMessages, posts, pushDevices });
  return { done, progress: progress(done), claimed: !!claimed };
}
