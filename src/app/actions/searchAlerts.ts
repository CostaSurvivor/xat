"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ALERTS, parseAlert, sameFilters } from "@/lib/searchAlerts";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";
import { toFilters } from "@/server/searchAlerts";

export type AlertState = { ok?: boolean; error?: string; msg?: string } | undefined;

/** Salva os filtros atuais de Pessoas como alerta. */
export async function saveSearchAlert(_: AlertState, fd: FormData): Promise<AlertState> {
  const user = await requireUser();
  const f = parseAlert({ tipo: fd.get("tipo"), uf: fd.get("uf"), raio: fd.get("raio"), curte: fd.get("curte"), foto: fd.get("foto") });
  if ("error" in f) return { ok: false, error: f.error };
  if (f.raio && (user.lat == null || user.lng == null)) return { ok: false, error: "Para alerta por distância, informe sua cidade no perfil." };
  if (!limiter("search-alert", 10, 10 / 3600).take(user.id)) return { ok: false, error: "Muitas alterações. Aguarde um pouco." };
  const mine = await db.searchAlert.findMany({ where: { userId: user.id } });
  if (mine.some((a) => sameFilters(toFilters(a), f))) return { ok: true, msg: "Você já tem um alerta com esses filtros." };
  if (mine.length >= ALERTS.max) return { ok: false, error: `Você pode ter até ${ALERTS.max} alertas. Apague um para criar outro.` };
  await db.searchAlert.create({ data: { userId: user.id, ...f } });
  revalidatePath("/pessoas");
  return { ok: true, msg: "🔔 Alerta criado! Avisamos quando entrar um novo perfil verificado assim." };
}

export async function deleteSearchAlert(id: string) {
  const user = await requireUser();
  await db.searchAlert.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/pessoas");
}
