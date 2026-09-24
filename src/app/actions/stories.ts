"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { STORIES, cleanCaption, postError } from "@/lib/stories";
import { isStaff, requireUser } from "@/server/auth";
import { MediaError, processUpload } from "@/server/media";
import { recordStoryView, storyViewers } from "@/server/stories";

type R = { ok?: boolean; error?: string };

export async function postStory(_: R | undefined, fd: FormData): Promise<R> {
  const user = await requireUser();
  if (!limiter("story", 10, 10 / 3600).take(user.id)) return { ok: false, error: "Muitos stories em pouco tempo. Aguarde." };
  const active = await db.story.count({ where: { authorId: user.id, deletedAt: null, expiresAt: { gt: new Date() } } });
  const err = postError(user, active);
  if (err) return { ok: false, error: err };
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma foto" };
  const cap = cleanCaption(fd.get("caption"));
  if ("error" in cap) return { ok: false, error: cap.error };
  const audience = fd.get("audience") === "FRIENDS" ? "FRIENDS" : "ALL";
  let media;
  try {
    media = await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: "STORY" });
  } catch (e) {
    return { ok: false, error: e instanceof MediaError ? e.message : "Falha ao processar a foto" };
  }
  await db.story.create({
    data: { authorId: user.id, mediaId: media.id, caption: cap.caption, audience, expiresAt: new Date(Date.now() + STORIES.ttlHours * 3600_000) },
  });
  revalidatePath("/feed");
  return { ok: true };
}

/** Apaga (some na hora; a foto some da hospedagem no expurgo). */
export async function deleteStory(id: string) {
  const user = await requireUser();
  const s = await db.story.findUnique({ where: { id } });
  if (!s || (s.authorId !== user.id && !isStaff(user))) return;
  await db.story.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/feed");
}

export async function markStoryViewed(id: string) {
  const user = await requireUser();
  await recordStoryView(user, id);
}

/** Lista de quem viu: só o autor. */
export async function storyViewersAction(id: string) {
  const user = await requireUser();
  const s = await db.story.findUnique({ where: { id }, select: { authorId: true } });
  if (!s || s.authorId !== user.id) return [];
  return (await storyViewers(id, user.id)).map((v) => ({ nick: v.nick, avatarId: v.avatarId, viewedAt: v.viewedAt.toISOString() }));
}
