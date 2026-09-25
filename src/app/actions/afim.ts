"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AFIM, parseAfim } from "@/lib/afim";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";

export type AfimState = { ok?: boolean; error?: string } | undefined;

/** Liga (ou renova) o "🔥 Afim hoje". Expira sozinho. */
export async function setAfim(_: AfimState, fd: FormData): Promise<AfimState> {
  const user = await requireUser();
  const parsed = parseAfim({ hours: fd.get("hours"), note: fd.get("note") });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (!limiter("afim-set", AFIM.perDay, AFIM.perDay / 86400).take(user.id))
    return { ok: false, error: `Você já ligou o status ${AFIM.perDay} vezes hoje. Volte amanhã.` };
  await db.user.update({ where: { id: user.id }, data: { afimUntil: parsed.until, afimNote: parsed.note } });
  revalidatePath("/pessoas");
  revalidatePath(`/u/${user.nick}`);
  return { ok: true };
}

/** Desliga na hora. */
export async function clearAfim() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { afimUntil: null, afimNote: null } });
  revalidatePath("/pessoas");
  revalidatePath(`/u/${user.nick}`);
}
