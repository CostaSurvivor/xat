import "server-only";
import { db } from "@/lib/db";
import { isConfirmed } from "@/lib/testimonials";

/** Quantos perfis verificados e ativos confirmaram ter conhecido cada usuário pessoalmente. */
export async function metInPersonCounts(userIds: string[]) {
  if (!userIds.length) return new Map<string, number>();
  const rows = await db.testimonial.groupBy({
    by: ["profileId"],
    where: { profileId: { in: userIds }, status: "APPROVED", withdrawnAt: null, metInPerson: true, author: { status: "ACTIVE", ageVerification: "APPROVED" } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.profileId, r._count._all]));
}

export async function confirmedIds(userIds: string[]) {
  const m = await metInPersonCounts(userIds);
  return new Set([...m].filter(([, n]) => isConfirmed(n)).map(([id]) => id));
}
