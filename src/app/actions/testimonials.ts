"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TESTIMONIALS, ownerTransition, testimonialSchema, writeError } from "@/lib/testimonials";
import { isStaff, requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";
import { notify } from "@/server/notify";

type R = { ok?: boolean; error?: string };

/** Escreve (ou reescreve) o depoimento para um perfil. Sempre volta para a aprovação do dono. */
export async function writeTestimonial(profileId: string, _: R | undefined, fd: FormData): Promise<R> {
  const user = await requireUser();
  const target = await db.user.findUnique({ where: { id: profileId }, select: { id: true, nick: true, ageVerification: true, status: true } });
  if (!target) return { ok: false, error: "Perfil não encontrado" };
  const err = writeError(user, target, await isBlockedBetween(user.id, target.id));
  if (err) return { ok: false, error: err };
  const parsed = testimonialSchema.safeParse({ body: fd.get("body") ?? "", metInPerson: fd.get("metInPerson") === "on" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const key = { profileId_authorId: { profileId, authorId: user.id } };
  const existing = await db.testimonial.findUnique({ where: key });
  if (!existing) {
    const today = await db.testimonial.count({ where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
    if (today >= TESTIMONIALS.perDay) return { ok: false, error: "Você já escreveu muitos depoimentos hoje. Tente amanhã." };
  }
  // oculto pelo dono: reescrever não reabre a aprovação (evita insistência); discreto, sem dizer que foi recusado
  if (existing?.status === "HIDDEN") return { ok: false, error: "Seu depoimento já está com o perfil, aguardando a decisão dele." };
  await db.testimonial.upsert({
    where: key,
    create: { profileId, authorId: user.id, body: parsed.data.body, metInPerson: parsed.data.metInPerson },
    update: { body: parsed.data.body, metInPerson: parsed.data.metInPerson, status: "PENDING", reviewedAt: null },
  });
  await notify(profileId, "TESTIMONIAL", `@${user.nick} ${existing ? "editou o depoimento" : "escreveu um depoimento"} para vocês. Aprove para aparecer no perfil.`, user.id);
  revalidatePath(`/u/${target.nick}`);
  return { ok: true };
}

/** Autor apaga o próprio depoimento. */
export async function deleteMyTestimonial(id: string) {
  const user = await requireUser();
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t || (t.authorId !== user.id && !isStaff(user))) return;
  await db.testimonial.delete({ where: { id } });
  revalidatePath("/depoimentos");
}

/** Dono do perfil: aprovar, ocultar ou excluir um depoimento recebido. */
export async function reviewTestimonial(id: string, op: "approve" | "hide" | "delete") {
  const user = await requireUser();
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t || t.profileId !== user.id) return;
  if (op === "delete") {
    await db.testimonial.delete({ where: { id } });
  } else {
    const next = ownerTransition(op, t.status);
    if (!next) return;
    await db.testimonial.update({ where: { id }, data: { status: next, reviewedAt: new Date() } });
    if (next === "APPROVED" && !t.reviewedAt) await notify(t.authorId, "TESTIMONIAL", `@${user.nick} aprovou seu depoimento 📝`, user.id, user.nick);
  }
  revalidatePath("/depoimentos");
  revalidatePath(`/u/${user.nick}`);
}
