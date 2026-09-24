"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { RESERVED_SLUGS, UFS } from "@/lib/config";
import { can } from "@/lib/permissions";
import { limiter } from "@/lib/ratelimit";
import { isSubscriber, requireUser } from "@/server/auth";
import { actorFor, canEnter, roomBySlug } from "@/server/rooms";
import { audit } from "@/server/notify";

type R = { ok?: boolean; error?: string } | undefined;

const roomSchema = z.object({
  name: z.string().trim().min(3, "Nome muito curto").max(60),
  description: z.string().trim().max(500).optional(),
  rules: z.string().trim().max(3000).optional(),
  state: z.union([z.enum(UFS as [string, ...string[]]), z.literal("")]).optional(),
  city: z.string().trim().max(80).optional(),
  access: z.enum(["PUBLIC", "MEMBERS_ONLY", "COUPLES_ONLY", "VERIFIED_ONLY"]),
  theme: z.enum(["noir", "vinho", "ouro", "neon"]),
  linksAllowed: z.string().optional(),
});

export async function createRoom(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !isSubscriber(user)) return { error: "Criar sala é exclusivo para assinantes." };
  if (!isAdmin && !limiter("room-create", 3, 3 / 86400).take(user.id)) return { error: "Limite de criação de salas atingido hoje." };
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(slug)) return { error: "Endereço: 3–32 caracteres (letras minúsculas, números e hífen)." };
  if (RESERVED_SLUGS.has(slug)) return { error: "Esse endereço é reservado." };
  if (await roomBySlug(slug)) return { error: "Esse endereço já existe." };
  if (!isAdmin && (await db.room.count({ where: { ownerId: user.id } })) >= 3) return { error: "Assinantes podem ter até 3 salas." };
  const p = roomSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  await db.room.create({
    data: {
      slug,
      name: d.name,
      description: d.description || null,
      rules: d.rules || null,
      state: d.state || null,
      city: d.city || null,
      access: d.access,
      theme: d.theme,
      linksAllowed: d.linksAllowed === "on",
      isOfficial: isAdmin && formData.get("official") === "on",
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  redirect(`/${slug}`);
}

export async function updateRoom(slug: string, _: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) return { error: "Sala não encontrada" };
  if (!can(await actorFor(user, room.id), "edit_room")) return { error: "Sem permissão" };
  const p = roomSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  await db.room.update({
    where: { id: room.id },
    data: { name: d.name, description: d.description || null, rules: d.rules || null, state: d.state || null, city: d.city || null, access: d.access, theme: d.theme, linksAllowed: d.linksAllowed === "on" },
  });
  const words = String(formData.get("bannedWords") || "").split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2).slice(0, 200);
  await db.roomBannedWord.deleteMany({ where: { roomId: room.id } });
  if (words.length) await db.roomBannedWord.createMany({ data: [...new Set(words)].map((word) => ({ roomId: room.id, word: word.slice(0, 60) })) });
  await audit(user.id, "room.update", "Room", room.id);
  revalidatePath(`/${slug}`);
  return { ok: true };
}

export async function joinRoom(slug: string) {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room || room.access === "MEMBERS_ONLY") return;
  // mesmas regras da entrada (só casais, só verificados, banido, sala inativa): virar membro não pode furá-las
  if (await canEnter(user, room, await actorFor(user, room.id))) return;
  await db.roomMember.upsert({ where: { roomId_userId: { roomId: room.id, userId: user.id } }, create: { roomId: room.id, userId: user.id }, update: {} });
  revalidatePath(`/${slug}`);
}

export async function leaveRoom(slug: string) {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) return;
  await db.roomMember.deleteMany({ where: { roomId: room.id, userId: user.id, role: { not: "OWNER" } } });
  revalidatePath(`/${slug}`);
}

/** Dono/mod adiciona membro; dono promove/rebaixa moderador. */
export async function manageMember(slug: string, _: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) return { error: "Sala não encontrada" };
  const nick = String(formData.get("nick") || "").trim();
  const op = String(formData.get("op"));
  const target = await db.user.findFirst({ where: { nick } });
  if (!target) return { error: "Nick não encontrado" };
  const actor = await actorFor(user, room.id);
  const tActor = await actorFor(target, room.id);
  if (op === "add") {
    if (!can(actor, "kick")) return { error: "Sem permissão" };
    await db.roomMember.upsert({ where: { roomId_userId: { roomId: room.id, userId: target.id } }, create: { roomId: room.id, userId: target.id }, update: {} });
  } else if (op === "promote") {
    if (tActor.role !== "GUEST" && tActor.role !== "MEMBER") return { error: "Já é moderador ou dono" };
    // convidado é tratado como membro para fins de promoção
    if (!can(actor, "promote_moderator", { ...tActor, role: "MEMBER" })) return { error: "Sem permissão" };
    await db.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: target.id } },
      create: { roomId: room.id, userId: target.id, role: "MODERATOR" },
      update: { role: "MODERATOR" },
    });
  } else if (op === "demote") {
    if (!can(actor, "demote_moderator", tActor)) return { error: "Sem permissão" };
    await db.roomMember.update({ where: { roomId_userId: { roomId: room.id, userId: target.id } }, data: { role: "MEMBER" } });
  } else if (op === "remove") {
    if (!can(actor, "kick", tActor)) return { error: "Sem permissão" };
    await db.roomMember.deleteMany({ where: { roomId: room.id, userId: target.id } });
  } else if (op === "unban") {
    if (!can(actor, "ban")) return { error: "Sem permissão" };
    await db.roomSanction.updateMany({ where: { roomId: room.id, userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await audit(user.id, `room.member.${op}`, "Room", room.id, { target: target.id });
  revalidatePath(`/${slug}/config`);
  return { ok: true };
}

export async function deleteRoom(slug: string) {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room || room.isOfficial) return;
  if (!can(await actorFor(user, room.id), "delete_room")) return;
  await db.room.delete({ where: { id: room.id } });
  await audit(user.id, "room.delete", "Room", room.id, { slug });
  redirect("/salas");
}

/** Dono (ou staff) define a foto de fundo da sala. */
export async function setRoomBackground(slug: string, _: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) return { error: "Sala não encontrada" };
  if (!can(await actorFor(user, room.id), "edit_room")) return { error: "Sem permissão" };
  if (formData.get("remove") === "1") {
    await db.room.update({ where: { id: room.id }, data: { bgMediaId: null } });
  } else {
    const file = formData.get("bg");
    if (!(file instanceof File) || !file.size) return { error: "Escolha uma imagem" };
    const { processUpload, MediaError } = await import("@/server/media");
    try {
      const m = await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: "ROOM_COVER", watermark: false });
      await db.room.update({ where: { id: room.id }, data: { bgMediaId: m.id } });
    } catch (e) {
      return { error: e instanceof MediaError ? e.message : "Falha ao processar a imagem" };
    }
  }
  await audit(user.id, "room.background", "Room", room.id);
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/config`);
  return { ok: true };
}
