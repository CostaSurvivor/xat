"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { REACTIONS } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { isStaff, isVerified, requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";
import { MediaError, processUpload, processVideo } from "@/server/media";
import { notify } from "@/server/notify";

type R = { ok: boolean; error?: string };

export async function createPost(_: R | undefined, formData: FormData): Promise<R> {
  const user = await requireUser();
  if (!limiter("post", 10, 10 / 3600).take(user.id)) return { ok: false, error: "Você postou muito em pouco tempo. Aguarde." };
  const body = String(formData.get("body") || "").trim().slice(0, 3000);
  const visibility = formData.get("visibility") === "FOLLOWERS" ? "FOLLOWERS" : "PUBLIC";
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);
  const video = formData.get("video");
  const hasVideo = video instanceof File && video.size > 0;
  if (!body && !files.length && !hasVideo) return { ok: false, error: "Escreva algo ou escolha fotos/vídeo" };
  if ((files.length || hasVideo) && !isVerified(user)) return { ok: false, error: "Verifique seu perfil para postar fotos e vídeos." };
  if (hasVideo && files.length) return { ok: false, error: "Poste fotos ou um vídeo (não os dois juntos)." };
  if (/https?:\/\/|www\./i.test(body)) return { ok: false, error: "Links não são permitidos nos posts." };

  const media = [];
  try {
    if (hasVideo) {
      const poster = formData.get("poster");
      media.push(await processVideo({ file: video as File, poster: poster instanceof File ? poster : null, ownerId: user.id, ownerNick: user.nick }));
    }
    for (const f of files) media.push(await processUpload({ file: f, ownerId: user.id, ownerNick: user.nick, kind: "POST" }));
  } catch (e) {
    return { ok: false, error: e instanceof MediaError ? e.message : "Falha ao processar a foto" };
  }
  await db.post.create({
    data: { authorId: user.id, body: body || null, visibility, media: { create: media.map((m, i) => ({ mediaId: m.id, position: i })) } },
  });
  revalidatePath("/feed");
  return { ok: true };
}

export async function deletePost(postId: string) {
  const user = await requireUser();
  const p = await db.post.findUnique({ where: { id: postId } });
  if (!p || (p.authorId !== user.id && !isStaff(user))) return;
  await db.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  revalidatePath("/feed");
}

export async function reactToPost(postId: string, emoji: string) {
  const user = await requireUser();
  if (!(REACTIONS as readonly string[]).includes(emoji)) return;
  if (!limiter("react", 60, 1).take(user.id)) return;
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt || (await isBlockedBetween(user.id, post.authorId))) return;
  const existing = await db.postReaction.findUnique({ where: { postId_userId: { postId, userId: user.id } } });
  if (existing?.emoji === emoji) {
    await db.postReaction.delete({ where: { postId_userId: { postId, userId: user.id } } });
  } else {
    await db.postReaction.upsert({ where: { postId_userId: { postId, userId: user.id } }, create: { postId, userId: user.id, emoji }, update: { emoji } });
    if (!existing) await notify(post.authorId, "POST_REACTION", `@${user.nick} reagiu ${emoji} ao seu post`, user.id, postId);
  }
}

const commentSchema = z.string().trim().min(1).max(1000);

export async function commentOnPost(postId: string, raw: string): Promise<R> {
  const user = await requireUser();
  if (!limiter("comment", 20, 20 / 600).take(user.id)) return { ok: false, error: "Calma! Muitos comentários seguidos." };
  const body = commentSchema.safeParse(raw);
  if (!body.success) return { ok: false, error: "Comentário vazio ou longo demais" };
  if (/https?:\/\/|www\./i.test(body.data)) return { ok: false, error: "Links não são permitidos" };
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) return { ok: false, error: "Post não encontrado" };
  if (await isBlockedBetween(user.id, post.authorId)) return { ok: false, error: "Indisponível" };
  await db.postComment.create({ data: { postId, authorId: user.id, body: body.data } });
  await notify(post.authorId, "POST_COMMENT", `@${user.nick} comentou: ${body.data.slice(0, 80)}`, user.id, postId);
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const c = await db.postComment.findUnique({ where: { id: commentId }, include: { post: true } });
  if (!c) return;
  if (c.authorId !== user.id && c.post.authorId !== user.id && !isStaff(user)) return;
  await db.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
}

export async function loadComments(postId: string) {
  const user = await requireUser();
  const { getComments } = await import("@/server/feed");
  return getComments(user.id, postId);
}
