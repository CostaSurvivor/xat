import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import { CONTOS, type ContoCategory } from "@/lib/contos";
import { isStaff, isVerified } from "@/server/auth";
import { blockedIds } from "@/server/access";

type Viewer = Pick<User, "id" | "role" | "ageVerification">;

/** Contos que esta pessoa pode ver: no ar, autor ativo, sem bloqueio, e respeitando "esconder de não verificados". */
export async function visibleWhere(viewer: Viewer): Promise<Prisma.ContoWhereInput> {
  const blocked = await blockedIds(viewer.id);
  return {
    deletedAt: null,
    authorId: blocked.length ? { notIn: blocked } : undefined,
    author: { status: "ACTIVE", ...(isVerified(viewer) || isStaff(viewer) ? {} : { OR: [{ hideFromUnverified: false }, { id: viewer.id }] }) },
  };
}

const authorSelect = { select: { id: true, nick: true, avatarId: true, profileType: true, ageVerification: true } } as const;

export async function listContos(viewer: Viewer, opts: { category?: ContoCategory; order: "recentes" | "populares"; page: number; authorId?: string }) {
  // AND: o filtro de autor não pode sobrescrever o "authorId notIn bloqueados" da visibilidade
  const where: Prisma.ContoWhereInput = {
    AND: [await visibleWhere(viewer), ...(opts.category ? [{ category: opts.category }] : []), ...(opts.authorId ? [{ authorId: opts.authorId }] : [])],
  };
  const [items, total] = await Promise.all([
    db.conto.findMany({
      where,
      orderBy: opts.order === "populares" ? [{ likeCount: "desc" }, { readCount: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      skip: (opts.page - 1) * CONTOS.pageSize,
      take: CONTOS.pageSize,
      include: { author: authorSelect },
    }),
    db.conto.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / CONTOS.pageSize)) };
}

/** Em alta: mais curtidos dos últimos 30 dias (para a tela principal). */
export async function hotContos(viewer: Viewer, take = 3) {
  return db.conto.findMany({
    where: { ...(await visibleWhere(viewer)), createdAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: [{ likeCount: "desc" }, { readCount: "desc" }, { createdAt: "desc" }],
    take,
    include: { author: authorSelect },
  });
}

/** Um conto para leitura; a equipe vê também os removidos (para julgar denúncias). */
export async function getConto(viewer: Viewer, id: string) {
  const staff = isStaff(viewer);
  const where = staff ? { id } : { ...(await visibleWhere(viewer)), id };
  const c = await db.conto.findFirst({ where, include: { author: authorSelect } });
  if (!c) return null;
  const liked = !!(await db.contoLike.findUnique({ where: { contoId_userId: { contoId: id, userId: viewer.id } } }));
  return { ...c, liked };
}

/** Conta a leitura uma vez por pessoa (o autor não conta). */
export async function recordRead(viewerId: string, c: { id: string; authorId: string }) {
  if (viewerId === c.authorId) return;
  const r = await db.contoRead.createMany({ data: [{ contoId: c.id, userId: viewerId }], skipDuplicates: true });
  if (r.count) await db.conto.update({ where: { id: c.id }, data: { readCount: { increment: 1 } } });
}

/** Comentários visíveis de um conto (sem quem está bloqueado, nos dois sentidos). */
export async function contoComments(viewer: Viewer, contoId: string) {
  const blocked = await blockedIds(viewer.id);
  return db.contoComment.findMany({
    where: {
      contoId,
      deletedAt: null,
      authorId: blocked.length ? { notIn: blocked } : undefined,
      author: { status: "ACTIVE", ...(isVerified(viewer) || isStaff(viewer) ? {} : { OR: [{ hideFromUnverified: false }, { id: viewer.id }] }) },
    },
    orderBy: { createdAt: "asc" },
    take: CONTOS.commentsShown,
    include: { author: { select: { nick: true } } },
  });
}
