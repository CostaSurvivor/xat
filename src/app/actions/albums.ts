"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { albumSchema, createAlbumError } from "@/lib/albums";
import { isVerified, requireUser } from "@/server/auth";

type R = { ok?: boolean; error?: string };

function parse(fd: FormData) {
  return albumSchema.safeParse({ name: fd.get("name") ?? "", emoji: fd.get("emoji") || "📁", visibility: fd.get("visibility") });
}

export async function createAlbum(_: R | undefined, fd: FormData): Promise<R> {
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para criar álbuns." };
  const err = createAlbumError(await db.album.count({ where: { ownerId: user.id } }));
  if (err) return { ok: false, error: err };
  const p = parse(fd);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const last = await db.album.findFirst({ where: { ownerId: user.id }, orderBy: { position: "desc" } });
  await db.album.create({ data: { ownerId: user.id, ...p.data, position: (last?.position ?? 0) + 1 } });
  revalidatePath("/perfil");
  return { ok: true };
}

export async function updateAlbum(id: string, _: R | undefined, fd: FormData): Promise<R> {
  const user = await requireUser();
  const a = await db.album.findUnique({ where: { id } });
  if (!a || a.ownerId !== user.id) return { ok: false, error: "Álbum não encontrado" };
  const p = parse(fd);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  await db.album.update({ where: { id }, data: p.data });
  revalidatePath("/perfil");
  return { ok: true };
}

/** Apaga o álbum e as fotos dele (some para todos na hora). */
export async function deleteAlbum(id: string) {
  const user = await requireUser();
  const a = await db.album.findUnique({ where: { id } });
  if (!a || a.ownerId !== user.id) return;
  await db.$transaction([
    db.media.updateMany({ where: { albumId: id, ownerId: user.id }, data: { status: "REMOVED", albumId: null } }),
    db.album.delete({ where: { id } }),
  ]);
  revalidatePath("/perfil");
}

/** Pedir acesso a UM álbum por tema. */
export async function requestThemedAlbum(albumId: string) {
  const user = await requireUser();
  const a = await db.album.findUnique({ where: { id: albumId }, include: { owner: { select: { id: true, nick: true } } } });
  if (!a || a.ownerId === user.id) return;
  const { isBlockedBetween } = await import("@/server/access");
  if (await isBlockedBetween(user.id, a.ownerId)) return;
  const key = { albumId_viewerId: { albumId, viewerId: user.id } };
  if (await db.themedAlbumAccess.findUnique({ where: key })) return;
  await db.themedAlbumAccess.create({ data: { albumId, viewerId: user.id } });
  const { notify } = await import("@/server/notify");
  await notify(a.ownerId, "ALBUM_REQUEST", `@${user.nick} pediu para ver o álbum ${a.emoji} ${a.name}`, user.id, user.id);
  revalidatePath(`/u/${a.owner.nick}`);
}

/** Dono libera ou revoga UM álbum para uma pessoa. */
export async function setThemedAlbumAccess(albumId: string, viewerId: string, granted: boolean) {
  const user = await requireUser();
  const a = await db.album.findUnique({ where: { id: albumId } });
  if (!a || a.ownerId !== user.id || viewerId === user.id) return;
  await db.themedAlbumAccess.upsert({ where: { albumId_viewerId: { albumId, viewerId } }, create: { albumId, viewerId, granted }, update: { granted } });
  if (granted) {
    const { notify } = await import("@/server/notify");
    await notify(viewerId, "ALBUM_GRANTED", `@${user.nick} liberou o álbum ${a.emoji} ${a.name} para vocês 🔓`, user.id);
  }
  revalidatePath("/perfil");
}
