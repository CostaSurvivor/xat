"use server";

import { db } from "@/lib/db";
import { SITE_NAME } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";
import { MediaError, processUpload } from "@/server/media";
import { canMessage, canSendPhoto, pairOf } from "@/server/pm";

export async function sendPmPhoto(nick: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const o = await db.user.findFirst({ where: { nick } });
  if (!o) return { ok: false, error: "Usuário não encontrado" };
  const denied = (await canMessage(user, o)) ?? canSendPhoto(user, o);
  if (denied) return { ok: false, error: denied };
  if (!limiter("pm-photo", 10, 10 / 3600).take(user.id)) return { ok: false, error: "Muitas fotos em pouco tempo." };
  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "Escolha uma foto" };
  try {
    // marca d'água com o nick de QUEM RECEBE: se vazar, dá para saber a origem
    const media = await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: "PM_PHOTO", watermarkText: `para @${o.nick} · ${SITE_NAME}` });
    const pair = pairOf(user.id, o.id);
    const conv = await db.conversation.upsert({ where: { userAId_userBId: pair }, create: pair, update: {} });
    const m = await db.privateMessage.create({ data: { conversationId: conv.id, senderId: user.id, mediaId: media.id } });
    await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: m.createdAt, lastSenderId: user.id } });
    void import("@/server/push").then((p) => p.pushNotification(o.id, "PM", `@${user.nick} enviou uma foto 📷`, { actorId: user.id }));
  } catch (e) {
    return { ok: false, error: e instanceof MediaError ? e.message : "Falha ao processar a foto" };
  }
  return { ok: true };
}

/** Destinatário consente em ver a foto (sai do blur). */
export async function revealPmPhoto(messageId: string) {
  const user = await requireUser();
  const m = await db.privateMessage.findUnique({ where: { id: BigInt(messageId) }, include: { conversation: true } });
  if (!m || m.senderId === user.id) return;
  if (m.conversation.userAId !== user.id && m.conversation.userBId !== user.id) return;
  if (!m.revealedAt) await db.privateMessage.update({ where: { id: m.id }, data: { revealedAt: new Date() } });
}
