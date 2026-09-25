"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { PLACES, parsePlace, parseReview, ratingDelta } from "@/lib/places";
import { todayBR } from "@/lib/trips";
import { isVerified, requireStaff, requireUser } from "@/server/auth";
import { audit, notify } from "@/server/notify";
import { FEATURES } from "@/lib/features";

const OFF = { ok: false, error: "Em breve." } as const;

type R = { ok?: boolean; error?: string } | undefined;

/** Sugerir lugar (perfil verificado). Vai para a fila da equipe. */
export async function suggestPlace(_: R, fd: FormData): Promise<R> {
  if (!FEATURES.lugares) return OFF;
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para sugerir lugares." };
  const p = parsePlace(Object.fromEntries(fd));
  if ("error" in p) return { ok: false, error: p.error };
  const lastDay = await db.place.count({ where: { suggestedById: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (lastDay >= PLACES.suggestPerDay) return { ok: false, error: `No máximo ${PLACES.suggestPerDay} sugestões por dia.` };
  const dup = await db.place.findFirst({ where: { name: p.name, city: p.city, state: p.state, status: { in: ["PENDING", "APPROVED"] } } });
  if (dup) return { ok: false, error: "Este lugar já está no guia (ou em análise)." };
  const place = await db.place.create({ data: { ...p, suggestedById: user.id } });
  revalidatePath("/lugares");
  redirect(`/lugares/${place.id}`);
}

/** Aprovar/recusar (equipe) — também usado pela fila rápida. */
export async function reviewPlace(id: string, fd: FormData) {
  const staff = await requireStaff();
  const op = String(fd.get("op"));
  const note = String(fd.get("note") || "").slice(0, 200) || null;
  const p = await db.place.findUnique({ where: { id } });
  if (!p || (op !== "approve" && op !== "reject" && op !== "remove")) return;
  const status = op === "approve" ? "APPROVED" : "REJECTED";
  await db.place.update({ where: { id }, data: { status, reviewNote: note, reviewedById: staff.id } });
  await audit(staff.id, `place.${op}`, "Place", id, { note });
  if (op !== "remove" && p.status === "PENDING")
    await notify(p.suggestedById, "PLACE", op === "approve" ? `📍 “${p.name}” entrou no guia de Lugares. Obrigado!` : `📍 Sua sugestão “${p.name}” não foi aceita${note ? `: ${note}` : ""}.`, undefined, id);
  revalidatePath("/lugares");
  revalidatePath(`/lugares/${id}`);
}

/** Avaliar (verificados): 1 avaliação por pessoa, dá para editar ou apagar. */
export async function saveReview(placeId: string, _: R, fd: FormData): Promise<R> {
  if (!FEATURES.lugares) return OFF;
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para avaliar." };
  const r = parseReview({ stars: fd.get("stars"), body: fd.get("body") });
  if ("error" in r) return { ok: false, error: r.error };
  if (!limiter("place-review", 10, 10 / 3600).take(user.id)) return { ok: false, error: "Muitas avaliações em pouco tempo." };
  const place = await db.place.findUnique({ where: { id: placeId } });
  if (!place || place.status !== "APPROVED") return { ok: false, error: "Lugar não encontrado." };
  await db.$transaction(async (tx) => {
    const prev = await tx.placeReview.findUnique({ where: { placeId_userId: { placeId, userId: user.id } } });
    await tx.placeReview.upsert({ where: { placeId_userId: { placeId, userId: user.id } }, create: { placeId, userId: user.id, ...r }, update: r });
    const d = ratingDelta(prev?.stars ?? null, r.stars);
    await tx.place.update({ where: { id: placeId }, data: { ratingSum: { increment: d.sum }, ratingCount: { increment: d.count } } });
  });
  revalidatePath(`/lugares/${placeId}`);
  return { ok: true };
}

export async function deleteReview(placeId: string) {
  const user = await requireUser();
  await db.$transaction(async (tx) => {
    const prev = await tx.placeReview.findUnique({ where: { placeId_userId: { placeId, userId: user.id } } });
    if (!prev) return;
    await tx.placeReview.delete({ where: { id: prev.id } });
    const d = ratingDelta(prev.stars, null);
    await tx.place.update({ where: { id: placeId }, data: { ratingSum: { increment: d.sum }, ratingCount: { increment: d.count } } });
  });
  revalidatePath(`/lugares/${placeId}`);
}

/** "Vou hoje" (verificados): liga/desliga; vale só para hoje. */
export async function toggleCheckin(placeId: string) {
  if (!FEATURES.lugares) return;
  const user = await requireUser();
  if (!isVerified(user)) return;
  if (!limiter("place-checkin", 20, 20 / 3600).take(user.id)) return;
  const place = await db.place.findUnique({ where: { id: placeId } });
  if (!place || place.status !== "APPROVED") return;
  const key = { placeId_userId_day: { placeId, userId: user.id, day: todayBR() } };
  const cur = await db.placeCheckin.findUnique({ where: key });
  if (cur) await db.placeCheckin.delete({ where: key });
  else await db.placeCheckin.create({ data: key.placeId_userId_day });
  revalidatePath(`/lugares/${placeId}`);
  revalidatePath("/lugares");
}
