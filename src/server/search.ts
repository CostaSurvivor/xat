import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { canSeeGroup } from "@/lib/groups";
import { visibleWhere } from "@/server/contos";

type Viewer = Pick<User, "id" | "role" | "ageVerification"> & Parameters<typeof canSeeGroup>[1];

/** O que mais combina com o texto além de pessoas: grupos, eventos, salas e contos (cada um com suas regras de visibilidade). */
export async function searchOthers(user: Viewer, q: string) {
  const [groups, events, rooms, contos] = await Promise.all([
    db.group.findMany({ where: { OR: [{ name: { contains: q } }, { description: { contains: q } }] }, take: 20 }),
    db.event.findMany({
      where: { status: "APPROVED", startsAt: { gt: new Date(Date.now() - 6 * 3600_000) }, OR: [{ title: { contains: q } }, { city: { contains: q } }, { venue: { contains: q } }] },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    db.room.findMany({ where: { isOfficial: true, name: { contains: q } }, take: 10, select: { slug: true, name: true } }),
    visibleWhere(user).then((w) =>
      db.conto.findMany({ where: { ...w, title: { contains: q } }, orderBy: { likeCount: "desc" }, take: 8, select: { id: true, title: true, likeCount: true, author: { select: { nick: true } } } }),
    ),
  ]);
  return { groups: groups.filter((g) => canSeeGroup(g, user)).slice(0, 8), events, rooms, contos };
}
