"use server";

import { db } from "@/lib/db";
import { SITE_NAME } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";
import { MediaError, processUpload } from "@/server/media";
import { canMessage, canSendAudio, canSendPhoto, pairOf } from "@/server/pm";
import { createHash, randomBytes } from "node:crypto";
import { storage } from "@/server/storage";
import { VOICE, clampSecs, sniffAudio, voiceClock } from "@/lib/voice";

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

/** Mensagem de voz (até 60 s). O formato é conferido pelos bytes, não pelo que o navegador diz. */
export async function sendPmAudio(nick: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const o = await db.user.findFirst({ where: { nick } });
  if (!o) return { ok: false, error: "Usuário não encontrado" };
  const denied = (await canMessage(user, o)) ?? (await canSendAudio(user, o.id));
  if (denied) return { ok: false, error: denied };
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size < VOICE.minBytes) return { ok: false, error: "Áudio muito curto." };
  if (file.size > VOICE.maxBytes) return { ok: false, error: `Áudio muito longo (máx. ${VOICE.maxSecs} s).` };
  if (!limiter("pm-audio", VOICE.perHour, VOICE.perHour / 3600).take(user.id)) return { ok: false, error: "Muitos áudios em pouco tempo." };
  const buf = Buffer.from(await file.arrayBuffer());
  const fmt = sniffAudio(buf);
  if (!fmt) return { ok: false, error: "Formato de áudio não suportado." };
  const secs = clampSecs(formData.get("secs"));
  const sha = createHash("sha256").update(buf).digest("hex");
  const d = new Date();
  const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(12).toString("hex")}/a.${fmt.ext}`;
  await storage.put(key, buf, fmt.mime);
  const media = await db.media.create({
    data: { ownerId: user.id, kind: "PM_AUDIO", originalKey: key, displayKey: key, blurKey: key, width: 0, height: 0, sha256: sha, mime: fmt.mime, sizeBytes: buf.length },
  });
  const pair = pairOf(user.id, o.id);
  const conv = await db.conversation.upsert({ where: { userAId_userBId: pair }, create: pair, update: {} });
  const m = await db.privateMessage.create({ data: { conversationId: conv.id, senderId: user.id, mediaId: media.id, audioSecs: secs } });
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: m.createdAt, lastSenderId: user.id } });
  void import("@/server/push").then((p) => p.pushNotification(o.id, "PM", `@${user.nick} enviou um áudio 🎤 (${voiceClock(secs)})`, { actorId: user.id }));
  return { ok: true };
}

/** Destinatário consente em ver a foto (sai do blur). */
export async function revealPmPhoto(messageId: string) {
  const user = await requireUser();
  const m = await db.privateMessage.findUnique({ where: { id: BigInt(messageId) }, include: { conversation: true } });
  if (!m || m.senderId === user.id || m.audioSecs != null) return;
  if (m.conversation.userAId !== user.id && m.conversation.userBId !== user.id) return;
  if (!m.revealedAt) await db.privateMessage.update({ where: { id: m.id }, data: { revealedAt: new Date() } });
}
