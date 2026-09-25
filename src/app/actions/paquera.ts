"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { isMatch, likeError } from "@/lib/paquera";
import { requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";
import { notify } from "@/server/notify";

type R = { ok: boolean; error?: string; match?: boolean; nick?: string };

export async function likeProfile(targetId: string): Promise<R> {
  const user = await requireUser();
  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, nick: true, ageVerification: true, status: true } });
  if (!target) return { ok: false, error: "Perfil não encontrado" };
  const today = await db.profileLike.count({ where: { likerId: user.id, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
  const err = likeError(user, target, await isBlockedBetween(user.id, target.id), today);
  if (err) return { ok: false, error: err };
  if (!limiter("paquera-like", 60, 60 / 3600).take(user.id)) return { ok: false, error: "Devagar! Muitas curtidas em pouco tempo." };
  const key = { likerId_likedId: { likerId: user.id, likedId: target.id } };
  const existing = await db.profileLike.findUnique({ where: key });
  if (existing && !existing.withdrawnAt) return { ok: true };
  if (existing) await db.profileLike.update({ where: key, data: { withdrawnAt: null } });
  else await db.profileLike.create({ data: { likerId: user.id, likedId: target.id } });
  await db.profileSkip.deleteMany({ where: { userId: user.id, skippedId: target.id } });
  const other = await db.profileLike.findUnique({ where: { likerId_likedId: { likerId: target.id, likedId: user.id } } });
  const back = !!other && !other.withdrawnAt;
  // curtir de novo (depois de desfazer) não avisa ninguém de novo: fecha o spam de curtir/descurtir
  if (!existing) {
    if (isMatch(true, back)) {
      // match: agora os dois sabem quem é
      await notify(target.id, "MATCH", `💘 Deu match com @${user.nick}! Mandem um oi no PV.`, user.id);
      await notify(user.id, "MATCH", `💘 Deu match com @${target.nick}! Mandem um oi no PV.`, target.id);
    } else {
      // curtida sem match: não revela quem foi (ver quem curtiu é benefício de assinante)
      await notify(target.id, "PROFILE_LIKE", "💘 Alguém curtiu vocês na Paquera. Veja em Paquera → Quem curtiu.");
    }
  }
  revalidatePath("/paquera");
  return { ok: true, match: back, nick: target.nick };
}

export async function skipProfile(targetId: string) {
  const user = await requireUser();
  if (targetId === user.id) return;
  await db.profileSkip.upsert({ where: { userId_skippedId: { userId: user.id, skippedId: targetId } }, create: { userId: user.id, skippedId: targetId }, update: { createdAt: new Date() } });
}

/** Desfazer curtida (também desfaz o match). */
export async function unlikeProfile(targetId: string) {
  const user = await requireUser();
  await db.profileLike.updateMany({ where: { likerId: user.id, likedId: targetId, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
  revalidatePath("/paquera/matches");
  revalidatePath("/paquera/curtidas");
}
