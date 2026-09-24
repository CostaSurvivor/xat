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
