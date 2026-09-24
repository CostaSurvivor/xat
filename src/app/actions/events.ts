"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { canCreateEvent, canSeeEvent, eventSchema, rsvpError } from "@/lib/events";
import { requireStaff, requireUser } from "@/server/auth";
import { audit, notify } from "@/server/notify";

type R = { ok?: boolean; error?: string } | undefined;

/** Cria o evento em análise; aparece para todos só depois que a equipe aprovar. */
export async function createEvent(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const denied = canCreateEvent(user);
  if (denied) return { error: denied };
  if (user.role === "USER" && !limiter("event-create", 3, 3 / 86400).take(user.id)) return { error: "Limite de 3 eventos por dia." };
  const p = eventSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  let coverMediaId: string | null = null;
  const file = formData.get("cover");
  if (file instanceof File && file.size) {
    const { processUpload, MediaError } = await import("@/server/media");
    try {
      coverMediaId = (await processUpload({ file, ownerId: user.id, ownerNick: user.nick, kind: "EVENT_COVER", watermark: false })).id;
    } catch (e) {
      return { error: e instanceof MediaError ? e.message : "Falha ao processar a imagem" };
    }
  }
  const staff = user.role !== "USER";
  const ev = await db.event.create({
    data: {
      creatorId: user.id,
      title: d.title,
      description: d.description,
      startsAt: d.startsAt,
      endsAt: d.endsAt instanceof Date ? d.endsAt : null,
      state: d.state,
      city: d.city,
      venue: d.venue,
      priceText: d.priceText || null,
      audience: d.audience,
      coverMediaId,
      // evento da equipe do site já sai aprovado
      status: staff ? "APPROVED" : "PENDING",
      reviewedById: staff ? user.id : null,
    },
  });
  await audit(user.id, "event.create", "Event", ev.id);
  revalidatePath("/eventos");
  redirect(`/eventos/${ev.id}`);
}

export async function cancelEvent(id: string) {
  const user = await requireUser();
  const ev = await db.event.findUnique({ where: { id } });
  if (!ev || (ev.creatorId !== user.id && user.role === "USER")) return;
  if (ev.status === "CANCELED") return;
  await db.event.update({ where: { id }, data: { status: "CANCELED" } });
  // avisa quem confirmou presença
  const going = await db.eventRsvp.findMany({ where: { eventId: id }, select: { userId: true } });
  if (going.length)
    await db.notification.createMany({ data: going.filter((g) => g.userId !== user.id).map((g) => ({ userId: g.userId, kind: "EVENT" as const, refId: id, actorId: user.id, text: `❌ Evento cancelado: ${ev.title}`.slice(0, 255) })) });
  await audit(user.id, "event.cancel", "Event", id);
  revalidatePath(`/eventos/${id}`);
  revalidatePath("/eventos");
}

/** "Vou" / "Talvez" / tirar presença (status vazio). */
export async function rsvpEvent(id: string, status: "GOING" | "MAYBE" | "") {
  const user = await requireUser();
  const ev = await db.event.findUnique({ where: { id } });
  if (!ev || !canSeeEvent(ev, user)) return { error: "Evento não encontrado" };
  const key = { eventId_userId: { eventId: id, userId: user.id } };
  if (!status) {
    await db.eventRsvp.deleteMany({ where: { eventId: id, userId: user.id } });
  } else {
    const err = rsvpError(ev, user);
    if (err) return { error: err };
    if (!limiter("event-rsvp", 20, 20 / 60).take(user.id)) return { error: "Devagar 🙂" };
    const had = await db.eventRsvp.findUnique({ where: key });
    await db.eventRsvp.upsert({ where: key, create: { eventId: id, userId: user.id, status }, update: { status } });
    if (!had && status === "GOING" && ev.creatorId !== user.id) await notify(ev.creatorId, "EVENT", `🎉 @${user.nick} vai ao seu evento: ${ev.title}`, user.id, id);
  }
  revalidatePath(`/eventos/${id}`);
  return { ok: true };
}

/** Equipe do site aprova ou recusa (com motivo). */
export async function reviewEvent(id: string, formData: FormData) {
  const staff = await requireStaff();
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  const ev = await db.event.findUnique({ where: { id } });
  if (!ev) return;
  if (op === "approve") {
    await db.event.update({ where: { id }, data: { status: "APPROVED", reviewedById: staff.id, reviewNote: note } });
    await notify(ev.creatorId, "EVENT", `✅ Seu evento foi aprovado: ${ev.title}`, staff.id, id);
  } else if (op === "reject") {
    await db.event.update({ where: { id }, data: { status: "REJECTED", reviewedById: staff.id, reviewNote: note } });
    await notify(ev.creatorId, "EVENT", `Seu evento não foi aprovado: ${ev.title}${note ? ` (${note})` : ""}`, staff.id, id);
  } else if (op === "cancel") {
    await db.event.update({ where: { id }, data: { status: "CANCELED", reviewedById: staff.id, reviewNote: note } });
  } else return;
  await audit(staff.id, `event.${op}`, "Event", id, { note });
  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
}
