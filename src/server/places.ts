import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import { PLACES, type PlaceKind } from "@/lib/places";
import { todayBR } from "@/lib/trips";
import { isStaff, isVerified } from "@/server/auth";
import { blockedIds } from "@/server/access";

type Viewer = Pick<User, "id" | "role" | "ageVerification">;

/** Quem aparece para este visitante (sem bloqueios; respeita "esconder de não verificados"). */
async function peopleWhere(viewer: Viewer): Promise<Prisma.UserWhereInput> {
  const blocked = await blockedIds(viewer.id);
  return {
    status: "ACTIVE",
    ...(blocked.length ? { id: { notIn: blocked } } : {}),
    ...(isVerified(viewer) || isStaff(viewer) ? {} : { OR: [{ hideFromUnverified: false }, { id: viewer.id }] }),
  };
}

export async function listPlaces(opts: { state?: string; city?: string; kind?: PlaceKind }) {
  const today = todayBR();
  const where: Prisma.PlaceWhereInput = { status: "APPROVED" };
  if (opts.state) where.state = opts.state;
  if (opts.city) where.city = { contains: opts.city };
  if (opts.kind) where.kind = opts.kind;
  const rows = await db.place.findMany({
    where,
    take: PLACES.pageSize,
    orderBy: [{ ratingCount: "desc" }, { name: "asc" }],
    include: { _count: { select: { checkins: { where: { day: today } } } } },
  });
  // quem tem gente indo hoje sobe
  return rows.map((p) => ({ ...p, goingToday: p._count.checkins })).sort((a, b) => b.goingToday - a.goingToday);
}

/** Um lugar: aprovado para todos; em análise/recusado só quem sugeriu e a equipe. */
export async function getPlace(viewer: Viewer, id: string) {
  const p = await db.place.findUnique({ where: { id }, include: { suggestedBy: { select: { nick: true } } } });
  if (!p) return null;
  if (p.status !== "APPROVED" && p.suggestedById !== viewer.id && !isStaff(viewer)) return null;
  return p;
}

export async function placeReviews(viewer: Viewer, placeId: string) {
  return db.placeReview.findMany({
    where: { placeId, user: await peopleWhere(viewer) },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, nick: true, avatarId: true, ageVerification: true } } },
  });
}

/** Quem vai hoje: a lista só para verificados (e equipe); os demais veem só o número. */
export async function goingToday(viewer: Viewer, placeId: string) {
  const day = todayBR();
  const [count, mine] = await Promise.all([
    db.placeCheckin.count({ where: { placeId, day } }),
    db.placeCheckin.findUnique({ where: { placeId_userId_day: { placeId, userId: viewer.id, day } } }),
  ]);
  const canSee = isVerified(viewer) || isStaff(viewer);
  const people = canSee
    ? await db.placeCheckin.findMany({
        where: { placeId, day, user: await peopleWhere(viewer) },
        orderBy: { createdAt: "asc" },
        take: 60,
        include: { user: { select: { id: true, nick: true, avatarId: true, profileType: true } } },
      })
    : [];
  return { count, mine: !!mine, canSee, people: people.map((c) => c.user) };
}
