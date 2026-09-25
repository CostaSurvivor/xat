"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { cleanNote, favoriteError } from "@/lib/favorites";
import { requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";

/** Favoritar / desfavoritar (privado: o outro perfil não é avisado). */
export async function toggleFavorite(targetId: string): Promise<{ on: boolean; error?: string }> {
  const user = await requireUser();
  const key = { ownerId_targetId: { ownerId: user.id, targetId } };
  if (await db.favorite.findUnique({ where: key })) {
    await db.favorite.deleteMany({ where: { ownerId: user.id, targetId } });
    revalidatePath("/favoritos");
    return { on: false };
  }
  if (!limiter("favorite", 60, 60 / 3600).take(user.id)) return { on: false, error: "Muitas ações seguidas. Aguarde." };
  const target = await db.user.findUnique({ where: { id: targetId }, select: { status: true } });
  if (!target || target.status !== "ACTIVE") return { on: false, error: "Perfil indisponível" };
  const err = favoriteError(user.id, targetId, await db.favorite.count({ where: { ownerId: user.id } }), await isBlockedBetween(user.id, targetId));
  if (err) return { on: false, error: err };
  await db.favorite.createMany({ data: [{ ownerId: user.id, targetId }], skipDuplicates: true });
  revalidatePath("/favoritos");
  return { on: true };
}

/** Anotação privada sobre um favorito (só o dono vê). */
export async function saveFavoriteNote(targetId: string, _: unknown, fd: FormData): Promise<{ ok?: boolean; error?: string; n?: number }> {
  const user = await requireUser();
  const c = cleanNote(fd.get("note"));
  if ("error" in c) return { ok: false, error: c.error };
  if (!limiter("favorite-note", 60, 60 / 3600).take(user.id)) return { ok: false, error: "Muitas alterações seguidas. Aguarde." };
  const r = await db.favorite.updateMany({ where: { ownerId: user.id, targetId }, data: { note: c.note } });
  if (!r.count) return { ok: false, error: "Favorite o perfil antes de anotar" };
  revalidatePath("/favoritos");
  return { ok: true, n: Date.now() };
}
