"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { requireStaff, requireUser } from "@/server/auth";
import { audit, notify } from "@/server/notify";

type R = { ok?: boolean; error?: string } | undefined;


const NICK_RE = /^[A-Za-z0-9_.]{3,20}$/;

const newSchema = z.object({
  category: z.enum(["NICK_CHANGE", "PROFILE_TYPE", "PAYMENT", "ACCOUNT", "VERIFICATION", "REPORT", "SUGGESTION", "OTHER"]),
  subject: z.string().trim().min(3, "Assunto muito curto").max(120),
  body: z.string().trim().min(5, "Descreva um pouco mais").max(4000),
  requestedNick: z.string().trim().optional(),
});

export async function openTicket(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  if (!limiter("ticket", 5, 5 / 3600).take(user.id)) return { error: "Muitos chamados em pouco tempo." };
  const p = newSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  let requestedNick: string | null = null;
  if (d.category === "NICK_CHANGE") {
    if (!d.requestedNick || !NICK_RE.test(d.requestedNick)) return { error: "Novo nick: 3–20 caracteres (letras, números, _ e .)" };
    if (await db.user.findFirst({ where: { nick: d.requestedNick } })) return { error: "Esse nick já está em uso" };
    if ((await db.ticket.count({ where: { userId: user.id, category: "NICK_CHANGE", status: { not: "CLOSED" } } })) > 0)
      return { error: "Você já tem um pedido de troca de nick em aberto." };
    requestedNick = d.requestedNick;
  }
  let requestedData: { type: string; births: string[] } | null = null;
  if (d.category === "PROFILE_TYPE") {
    const { PROFILE_TYPES } = await import("@/lib/config");
    const { allAdults, parseBirthDate } = await import("@/lib/age");
    const type = String(formData.get("requestedType") || "");
    if (!(type in PROFILE_TYPES)) return { error: "Escolha o novo tipo de perfil" };
    if (type === user.profileType) return { error: "Esse já é o seu tipo de perfil" };
    const n = PROFILE_TYPES[type as keyof typeof PROFILE_TYPES].persons.length;
    const births = [0, 1].slice(0, n).map((i) => String(formData.get(`birth${i}`) || ""));
    const parsed = births.map(parseBirthDate);
    if (parsed.some((b) => !b)) return { error: "Informe as datas de nascimento" };
    if (!allAdults(parsed as Date[])) return { error: "Todas as pessoas precisam ter 18 anos ou mais." };
    if ((await db.ticket.count({ where: { userId: user.id, category: "PROFILE_TYPE", status: { not: "CLOSED" } } })) > 0)
      return { error: "Você já tem um pedido de troca de tipo em aberto." };
    requestedData = { type, births };
  }
  const t = await db.ticket.create({
    data: {
      userId: user.id, category: d.category, subject: d.subject, requestedNick, requestedData: requestedData ?? undefined,
      messages: { create: { authorId: user.id, body: d.body } },
    },
  });
  redirect(`/suporte/${t.id}`);
}

export async function replyTicket(ticketId: string, _: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const t = await db.ticket.findUnique({ where: { id: ticketId } });
  const staff = user.role !== "USER";
  if (!t || (t.userId !== user.id && !staff)) return { error: "Chamado não encontrado" };
  if (!limiter("ticket-reply", 20, 20 / 600).take(user.id)) return { error: "Devagar!" };
  const body = String(formData.get("body") || "").trim().slice(0, 4000);
  if (!body) return { error: "Escreva a mensagem" };
  const fromStaff = staff && t.userId !== user.id;
  await db.ticketMessage.create({ data: { ticketId, authorId: user.id, fromStaff, body } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: fromStaff ? "ANSWERED" : "OPEN" } });
  if (fromStaff) await notify(t.userId, "TICKET", `🎫 A administração respondeu seu chamado: ${t.subject}`, undefined, t.id);
  revalidatePath(`/suporte/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true };
}

export async function closeTicket(ticketId: string) {
  const user = await requireUser();
  const t = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!t || (t.userId !== user.id && user.role === "USER")) return;
  await db.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
  revalidatePath(`/suporte/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
}

/** Admin aprova troca de nick pedida no chamado. */
export async function approveNickChange(ticketId: string) {
  const staff = await requireStaff();
  const t = await db.ticket.findUnique({ where: { id: ticketId }, include: { user: true } });
  if (!t || t.category !== "NICK_CHANGE" || !t.requestedNick || t.status === "CLOSED") return;
  const taken = await db.user.findFirst({ where: { nick: t.requestedNick, NOT: { id: t.userId } } });
  if (taken) {
    await db.ticketMessage.create({ data: { ticketId, authorId: staff.id, fromStaff: true, body: `O nick "${t.requestedNick}" foi ocupado por outra pessoa. Abra um novo pedido com outra opção.` } });
    await db.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
  } else {
    const old = t.user.nick;
    await db.user.update({ where: { id: t.userId }, data: { nick: t.requestedNick } });
    await db.ticketMessage.create({ data: { ticketId, authorId: staff.id, fromStaff: true, body: `Pronto! Seu nick mudou de ${old} para ${t.requestedNick}.` } });
    await db.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
    await audit(staff.id, "user.nick_change", "User", t.userId, { from: old, to: t.requestedNick, ticket: t.id });
  }
  await notify(t.userId, "TICKET", `🎫 Seu pedido de troca de nick foi analisado.`, undefined, t.id);
  revalidatePath(`/admin/tickets/${ticketId}`);
}

/** Moderação aprova troca de tipo de perfil pedida no chamado. */
export async function approveProfileType(ticketId: string) {
  const staff = await requireStaff();
  const t = await db.ticket.findUnique({ where: { id: ticketId } });
  const data = t?.requestedData as { type: string; births: string[] } | null;
  if (!t || t.category !== "PROFILE_TYPE" || !data || t.status === "CLOSED") return;
  const { applyProfileType } = await import("@/server/profileType");
  const { PROFILE_TYPES } = await import("@/lib/config");
  const r = await applyProfileType(t.userId, data.type, data.births, staff.id);
  const label = PROFILE_TYPES[data.type as keyof typeof PROFILE_TYPES]?.label ?? data.type;
  const body = r.error
    ? `Não foi possível aplicar: ${r.error}`
    : `Pronto! Seu perfil agora é "${label}".${r.reverify ? " Como entrou uma pessoa nova, refaça a verificação por selfie com as duas pessoas aparecendo." : ""}`;
  await db.ticketMessage.create({ data: { ticketId, authorId: staff.id, fromStaff: true, body } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
  await notify(t.userId, "TICKET", "🎫 Seu pedido de troca de tipo de perfil foi analisado.", undefined, t.id);
  revalidatePath(`/admin/tickets/${ticketId}`);
}
