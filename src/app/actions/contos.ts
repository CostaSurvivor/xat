"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { canDeleteComment, canDeleteConto, canEditConto, parseComment, parseConto, publishError } from "@/lib/contos";
import { requireUser } from "@/server/auth";
import { getConto } from "@/server/contos";
import { audit, notify } from "@/server/notify";

type R = { ok?: boolean; error?: string };

/** Publica um conto novo ou salva a edição (id). Ao publicar, vai para a página do conto. */
export async function saveConto(id: string | null, _: R | undefined, fd: FormData): Promise<R> {
  const user = await requireUser();
  const parsed = parseConto({ title: fd.get("title"), category: fd.get("category"), body: fd.get("body") });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (!limiter("conto-save", 20, 20 / 3600).take(user.id)) return { ok: false, error: "Muitas alterações em pouco tempo. Aguarde." };

  if (id) {
    const c = await db.conto.findUnique({ where: { id } });
    if (!c || !canEditConto(c, user)) return { ok: false, error: "Conto não encontrado" };
    await db.conto.update({ where: { id }, data: parsed });
    revalidatePath(`/contos/${id}`);
    redirect(`/contos/${id}`);
  }

  // conta também os apagados: apagar e republicar não burla o limite
  const lastDay = await db.conto.count({ where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  const err = publishError(user, lastDay);
  if (err) return { ok: false, error: err };
  const c = await db.conto.create({ data: { ...parsed, authorId: user.id } });
  revalidatePath("/contos");
  redirect(`/contos/${c.id}`);
}

/** O autor apaga; a equipe remove (fica registrado). */
export async function deleteConto(id: string) {
  const user = await requireUser();
  const c = await db.conto.findUnique({ where: { id } });
  if (!c || !canDeleteConto(c, user)) return;
  await db.conto.update({ where: { id }, data: { deletedAt: new Date() } });
  if (c.authorId !== user.id) await audit(user.id, "conto.delete", "Conto", id, { authorId: c.authorId, title: c.title });
  revalidatePath("/contos");
  redirect("/contos");
}

/** Curtir / descurtir. Avisa o autor só na primeira curtida de cada pessoa por dia. */
export async function toggleContoLike(id: string): Promise<{ liked: boolean; count: number } | null> {
  const user = await requireUser();
  if (!limiter("conto-like", 60, 1).take(user.id)) return null;
  const c = await getConto(user, id);
  if (!c || c.deletedAt || c.authorId === user.id) return null;
  const key = { contoId_userId: { contoId: id, userId: user.id } };
  if (c.liked) {
    const r = await db.contoLike.deleteMany({ where: key.contoId_userId });
    if (r.count) await db.conto.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
  } else {
    const r = await db.contoLike.createMany({ data: [{ contoId: id, userId: user.id }], skipDuplicates: true });
    if (r.count) {
      await db.conto.update({ where: { id }, data: { likeCount: { increment: 1 } } });
      if (limiter("conto-like-notify", 1, 1 / 86400).take(`${user.id}:${id}`))
        await notify(c.authorId, "CONTO", `@${user.nick} curtiu seu conto “${c.title.slice(0, 60)}” 📖`, user.id, id);
    }
  }
  const fresh = await db.conto.findUnique({ where: { id }, select: { likeCount: true } });
  return { liked: !c.liked, count: Math.max(0, fresh?.likeCount ?? 0) };
}

export type CommentState = { ok?: boolean; error?: string; n?: number } | undefined;

/** Comenta num conto visível (bloqueios valem nos dois sentidos). Avisa o autor do conto. */
export async function addContoComment(contoId: string, prev: CommentState, fd: FormData): Promise<CommentState> {
  const user = await requireUser();
  const n = (prev?.n ?? 0) + 1;
  const parsed = parseComment(fd.get("body"));
  if ("error" in parsed) return { ok: false, error: parsed.error, n };
  if (!limiter("conto-comment", 20, 20 / 600).take(user.id)) return { ok: false, error: "Calma! Muitos comentários seguidos.", n };
  const c = await getConto(user, contoId);
  if (!c || c.deletedAt) return { ok: false, error: "Conto não encontrado", n };
  await db.$transaction([
    db.contoComment.create({ data: { contoId, authorId: user.id, body: parsed.body } }),
    db.conto.update({ where: { id: contoId }, data: { commentCount: { increment: 1 } } }),
  ]);
  if (limiter("conto-comment-notify", 1, 1 / 1800).take(`${user.id}:${contoId}`))
    await notify(c.authorId, "CONTO_COMMENT", `@${user.nick} comentou no seu conto “${c.title.slice(0, 40)}”: ${parsed.body.slice(0, 80)}`, user.id, contoId);
  revalidatePath(`/contos/${contoId}`);
  return { ok: true, n };
}

/** Apaga: quem escreveu, o autor do conto ou a equipe (registrado). */
export async function deleteContoComment(id: string) {
  const user = await requireUser();
  const cm = await db.contoComment.findUnique({ where: { id }, include: { conto: { select: { id: true, authorId: true } } } });
  if (!cm || !canDeleteComment(cm, cm.conto, user)) return;
  // só quem de fato apagou desconta do contador (dois cliques ao mesmo tempo não descontam duas vezes)
  const r = await db.contoComment.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!r.count) return;
  await db.conto.update({ where: { id: cm.contoId }, data: { commentCount: { decrement: 1 } } });
  if (cm.authorId !== user.id && cm.conto.authorId !== user.id) await audit(user.id, "conto-comment.delete", "ContoComment", id, { authorId: cm.authorId });
  revalidatePath(`/contos/${cm.contoId}`);
}
