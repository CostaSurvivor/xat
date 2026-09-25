"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { LIKE_TAGS, UFS } from "@/lib/config";
import { coordsForProfile, roundCoord, validLatLng } from "@/lib/geo";
import { limiter } from "@/lib/ratelimit";
import { isVerified, requireUser } from "@/server/auth";
import { MediaError, processUpload } from "@/server/media";
import { notify } from "@/server/notify";

type R = { ok?: boolean; error?: string } | undefined;

const profileSchema = z.object({
  bio: z.string().max(1500).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.enum(UFS as [string, ...string[]]),
  pmPolicy: z.enum(["EVERYONE", "FRIENDS", "FOLLOWING", "COUPLES", "NOBODY"]),
});

export async function updateProfile(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const p = profileSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const likes = formData.getAll("likes").map(String).filter((t) => LIKE_TAGS.includes(t));
  await db.user.update({
    where: { id: user.id },
    data: {
      bio: p.data.bio?.trim() || null,
      statusText: String(formData.get("statusText") || "").replace(/\s+/g, " ").trim().slice(0, 60) || null,
      city: p.data.city || null,
      state: p.data.state,
      pmPolicy: p.data.pmPolicy,
      likes,
      hideCity: formData.get("hideCity") === "on",
      showDistance: formData.get("showDistance") === "on",
      paqueraHidden: formData.get("inPaquera") !== "on",
      ...coordsForProfile(p.data.city || null, p.data.state, user),
      hideFromUnverified: formData.get("hideFromUnverified") === "on",
      acceptPmPhotos: formData.get("acceptPmPhotos") === "on",
      albumVisibility: ["PRIVATE", "FRIENDS", "FOLLOWERS"].includes(String(formData.get("albumVisibility"))) ? String(formData.get("albumVisibility")) : "FRIENDS",
    },
  });
  revalidatePath("/perfil");
  return { ok: true };
}

export async function uploadPhoto(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  if (!isVerified(user)) return { error: "Verifique seu perfil para enviar fotos." };
  if (!limiter("photo", 30, 30 / 3600).take(user.id)) return { error: "Muitas fotos em pouco tempo." };
  const kind = String(formData.get("kind"));
  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Escolha uma foto" };
  if (!["AVATAR", "PRIVATE_ALBUM"].includes(kind)) return { error: "Tipo inválido" };
  const albumId = kind === "PRIVATE_ALBUM" ? String(formData.get("albumId") || "") || null : null;
  if (albumId && !(await db.album.findFirst({ where: { id: albumId, ownerId: user.id } }))) return { error: "Álbum não encontrado" };
  if (kind === "PRIVATE_ALBUM" && (await db.media.count({ where: { ownerId: user.id, kind: "PRIVATE_ALBUM", status: "APPROVED", albumId } })) >= 30)
    return { error: "Álbum cheio (máx. 30 fotos)." };
  try {
    const m = await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: kind as "AVATAR" | "PRIVATE_ALBUM" });
    if (albumId) await db.media.update({ where: { id: m.id }, data: { albumId } });
    if (kind === "AVATAR") await db.user.update({ where: { id: user.id }, data: { avatarId: m.id } });
  } catch (e) {
    return { error: e instanceof MediaError ? e.message : "Falha ao processar a foto" };
  }
  revalidatePath("/perfil");
  return { ok: true };
}

export async function deleteMedia(mediaId: string) {
  const user = await requireUser();
  const m = await db.media.findUnique({ where: { id: mediaId } });
  if (!m || m.ownerId !== user.id) return;
  await db.media.update({ where: { id: mediaId }, data: { status: "REMOVED" } });
  if (user.avatarId === mediaId) await db.user.update({ where: { id: user.id }, data: { avatarId: null } });
  revalidatePath("/perfil");
}

export async function toggleFollow(targetId: string) {
  const user = await requireUser();
  if (targetId === user.id) return;
  const key = { followerId_followeeId: { followerId: user.id, followeeId: targetId } };
  if (await db.follow.findUnique({ where: key })) await db.follow.delete({ where: key });
  else {
    await db.follow.create({ data: { followerId: user.id, followeeId: targetId } });
    await notify(targetId, "FOLLOW", `@${user.nick} começou a seguir vocês`, user.id);
  }
  revalidatePath("/u/[nick]", "page");
}

export async function toggleBlock(targetId: string) {
  const user = await requireUser();
  if (targetId === user.id) return;
  const key = { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } };
  if (await db.block.findUnique({ where: key })) await db.block.delete({ where: key });
  else {
    await db.block.create({ data: { blockerId: user.id, blockedId: targetId } });
    await db.follow.deleteMany({ where: { OR: [{ followerId: user.id, followeeId: targetId }, { followerId: targetId, followeeId: user.id }] } });
    await db.friendship.deleteMany({ where: { OR: [{ requesterId: user.id, addresseeId: targetId }, { requesterId: targetId, addresseeId: user.id }] } });
  }
  revalidatePath("/u/[nick]", "page");
}

export async function requestAlbum(ownerId: string) {
  const user = await requireUser();
  if (ownerId === user.id) return;
  const exists = await db.albumAccess.findUnique({ where: { ownerId_viewerId: { ownerId, viewerId: user.id } } });
  if (exists) return;
  await db.albumAccess.create({ data: { ownerId, viewerId: user.id } });
  await notify(ownerId, "ALBUM_REQUEST", `@${user.nick} pediu para ver seu álbum privado`, user.id, user.id);
  revalidatePath("/u/[nick]", "page");
}

export async function setAlbumAccess(viewerId: string, granted: boolean) {
  const user = await requireUser();
  await db.albumAccess.upsert({
    where: { ownerId_viewerId: { ownerId: user.id, viewerId } },
    create: { ownerId: user.id, viewerId, granted },
    update: { granted },
  });
  if (granted) await notify(viewerId, "ALBUM_GRANTED", `@${user.nick} liberou o álbum privado para vocês 🔓`, user.id);
  revalidatePath("/perfil");
  revalidatePath("/notificacoes");
}

const GESTURES = [
  "mão aberta ao lado do rosto",
  "sinal de paz (✌️) com a mão esquerda",
  "polegar para cima perto do queixo",
  "três dedos levantados",
  "mão no topo da cabeça",
  "apontando para a câmera",
  "sinal de OK (👌)",
];

export async function randomGesture() {
  return GESTURES[Math.floor(Math.random() * GESTURES.length)];
}

export async function submitVerification(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  if (user.ageVerification === "APPROVED") return { ok: true };
  if (!limiter("verif", 3, 3 / 86400).take(user.id)) return { error: "Limite de envios atingido. Tente amanhã." };
  const gesture = String(formData.get("gesture") || "");
  if (!GESTURES.includes(gesture)) return { error: "Gesto inválido, recarregue a página." };
  const file = formData.get("selfie");
  if (!(file instanceof File) || !file.size) return { error: "Envie a selfie" };
  try {
    const m = await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: "VERIFICATION_SELFIE", watermark: false });
    await db.verificationRequest.create({ data: { userId: user.id, gesture, mediaId: m.id } });
    await db.user.update({ where: { id: user.id }, data: { ageVerification: "PENDING" } });
    await (await import("@/server/staffAlerts")).alertStaffVerification();
  } catch (e) {
    return { error: e instanceof MediaError ? e.message : "Falha ao processar a foto" };
  }
  redirect("/verificacao");
}

export async function updatePersons(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const { PERSON_FIELDS } = await import("@/lib/config");
  const persons = await db.profilePerson.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
  const { parseBirthDate, isAdult } = await import("@/lib/age");
  const births = new Map<string, Date>();
  for (const p of persons) {
    const raw = String(formData.get(`${p.id}.birthDate`) || "");
    if (!raw) continue;
    const d = parseBirthDate(raw);
    if (!d) return { error: `Data de nascimento inválida (${p.label})` };
    if (!isAdult(d)) return { error: "Todas as pessoas do perfil precisam ter 18 anos ou mais." };
    births.set(p.id, d);
  }
  for (const p of persons) {
    const data: Record<string, string | number | null> = {};
    for (const [key, def] of Object.entries(PERSON_FIELDS)) {
      const v = String(formData.get(`${p.id}.${key}`) || "");
      data[key] = (def.options as readonly string[]).includes(v) ? v : null;
    }
    const h = Number(formData.get(`${p.id}.heightCm`) || 0);
    data.heightCm = Number.isInteger(h) && h >= 120 && h <= 230 ? h : null;
    const nb = births.get(p.id);
    if (nb && nb.getTime() !== p.birthDate.getTime()) {
      (data as Record<string, unknown>).birthDate = nb;
      const { audit } = await import("@/server/notify");
      await audit(user.id, "profile.birthdate", "ProfilePerson", p.id, { from: p.birthDate.toISOString().slice(0, 10), to: nb.toISOString().slice(0, 10) });
    }
    await db.profilePerson.update({ where: { id: p.id }, data });
  }
  const first = persons[0];
  if (first && births.get(first.id)) await db.user.update({ where: { id: user.id }, data: { birthDate: births.get(first.id)! } });
  revalidatePath("/perfil");
  return { ok: true };
}

// ---------------- Amizades ----------------
export async function sendFriendRequest(targetId: string) {
  const user = await requireUser();
  if (targetId === user.id) return;
  if (!limiter("friend", 30, 30 / 3600).take(user.id)) return;
  const { isBlockedBetween } = await import("@/server/access");
  if (await isBlockedBetween(user.id, targetId)) return;
  const reverse = await db.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: user.id } } });
  if (reverse) {
    // a outra pessoa já tinha pedido: aceita direto
    if (reverse.status !== "ACCEPTED") {
      await db.friendship.update({ where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: user.id } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      await notify(targetId, "FRIEND_ACCEPTED", `@${user.nick} aceitou seu pedido de amizade 🤝`, user.id);
    }
  } else {
    const created = await db.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: user.id, addresseeId: targetId } },
      create: { requesterId: user.id, addresseeId: targetId },
      update: {},
    });
    if (created.status === "PENDING") await notify(targetId, "FRIEND_REQUEST", `@${user.nick} quer ser seu amigo`, user.id, user.id);
  }
  revalidatePath("/u/[nick]", "page");
  revalidatePath("/notificacoes");
}

export async function respondFriendRequest(requesterId: string, accept: boolean) {
  const user = await requireUser();
  const key = { requesterId_addresseeId: { requesterId, addresseeId: user.id } };
  const f = await db.friendship.findUnique({ where: key });
  if (!f || f.status !== "PENDING") return;
  if (accept) {
    await db.friendship.update({ where: key, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    await notify(requesterId, "FRIEND_ACCEPTED", `@${user.nick} aceitou seu pedido de amizade 🤝`, user.id);
  } else {
    await db.friendship.delete({ where: key });
  }
  revalidatePath("/notificacoes");
  revalidatePath("/u/[nick]", "page");
}

/** Cancela pedido enviado ou desfaz amizade. */
export async function removeFriend(otherId: string) {
  const user = await requireUser();
  await db.friendship.deleteMany({
    where: { OR: [{ requesterId: user.id, addresseeId: otherId }, { requesterId: otherId, addresseeId: user.id }] },
  });
  revalidatePath("/u/[nick]", "page");
  revalidatePath("/amigos");
}

/** Troca de tipo de perfil direta: só ADMIN (usuários pedem por ticket). */
export async function updateProfileType(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Peça a troca de tipo de perfil pelo Suporte." };
  const { applyProfileType } = await import("@/server/profileType");
  const births = [0, 1].map((i) => String(formData.get(`birth${i}`) || "")).filter(Boolean);
  const r = await applyProfileType(user.id, String(formData.get("profileType")), births, user.id);
  if (r.error) return { error: r.error };
  revalidatePath("/perfil");
  return { ok: true };
}

/** "Usar minha localização aproximada": grava com 2 casas (~1 km), nunca a posição exata. */
export async function setApproxLocation(lat: number, lng: number): Promise<R> {
  const user = await requireUser();
  if (!limiter("geo", 10, 10 / 3600).take(user.id)) return { error: "Tente de novo mais tarde." };
  if (!validLatLng(lat, lng)) return { error: "Localização fora do Brasil ou inválida." };
  await db.user.update({ where: { id: user.id }, data: { lat: roundCoord(lat), lng: roundCoord(lng), geoSource: "GPS" } });
  revalidatePath("/pessoas");
  revalidatePath("/perfil");
  return { ok: true };
}

/** Volta a calcular a distância pela cidade do perfil (apaga a localização do aparelho). */
export async function resetToCityLocation(): Promise<R> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: coordsForProfile(user.city, user.state ?? "", { geoSource: null }) });
  revalidatePath("/pessoas");
  revalidatePath("/perfil");
  return { ok: true };
}
