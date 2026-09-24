import { z } from "zod";
import { UFS, isCouple } from "@/lib/config";

/** Regras puras dos Eventos (testadas em tests/events.test.ts). */

export const EVENT_TZ = "America/Sao_Paulo";

/** O campo datetime-local chega sem fuso ("2026-09-26T22:00"): interpreta como horário de Brasília. */
export function parseBrLocal(v: unknown) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return new Date(`${v.length === 16 ? `${v}:00` : v}-03:00`);
  return v;
}

/** Data/hora do evento sempre no fuso de Brasília (o servidor roda em UTC). */
export function fmtEventDate(d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) {
  return d.toLocaleString("pt-BR", { timeZone: EVENT_TZ, ...opts });
}

export const eventSchema = z
  .object({
    title: z.string().trim().min(5, "Título muito curto").max(90),
    description: z.string().trim().min(20, "Conte um pouco mais sobre o evento (20+ caracteres)").max(4000),
    startsAt: z.preprocess(parseBrLocal, z.coerce.date({ errorMap: () => ({ message: "Data de início inválida" }) })),
    endsAt: z.union([z.literal(""), z.preprocess(parseBrLocal, z.coerce.date())]).optional(),
    state: z.enum(UFS as [string, ...string[]], { errorMap: () => ({ message: "Escolha o estado" }) }),
    city: z.string().trim().min(2, "Informe a cidade").max(80),
    venue: z.string().trim().min(2, "Informe o local").max(120),
    priceText: z.string().trim().max(80).optional(),
    audience: z.enum(["ALL", "COUPLES"]),
  })
  .superRefine((d, ctx) => {
    const now = Date.now();
    if (d.startsAt.getTime() < now - 3600_000) ctx.addIssue({ code: "custom", message: "A data de início já passou" });
    if (d.startsAt.getTime() > now + 365 * 86400_000) ctx.addIssue({ code: "custom", message: "Eventos com até 1 ano de antecedência" });
    if (d.endsAt instanceof Date && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", message: "O fim precisa ser depois do início" });
    if (d.endsAt instanceof Date && d.endsAt.getTime() - d.startsAt.getTime() > 7 * 86400_000) ctx.addIssue({ code: "custom", message: "Evento de no máximo 7 dias" });
  });

/** Criar evento: equipe do site, ou assinante com perfil verificado. */
export function canCreateEvent(u: { role: string; ageVerification: string; vipUntil: Date | null }, now = new Date()) {
  if (u.role !== "USER") return null;
  if (!(u.vipUntil && u.vipUntil > now)) return "Criar eventos é exclusivo para assinantes.";
  if (u.ageVerification !== "APPROVED") return "Verifique seu perfil (selfie) para criar eventos.";
  return null;
}

/** Quem vê o evento: aprovado para todos; em análise/recusado só o criador e a equipe. */
export function canSeeEvent(e: { status: string; creatorId: string }, viewer: { id: string; role: string }) {
  if (e.status === "APPROVED" || e.status === "CANCELED") return true;
  return viewer.id === e.creatorId || viewer.role !== "USER";
}

/** Confirmar presença: evento aprovado, ainda não terminou, e "só casais" exige perfil de casal. */
export function rsvpError(e: { status: string; startsAt: Date; endsAt: Date | null; audience: string }, viewer: { profileType: string }, now = Date.now()) {
  if (e.status !== "APPROVED") return "Evento indisponível.";
  const end = (e.endsAt ?? new Date(e.startsAt.getTime() + 12 * 3600_000)).getTime();
  if (end < now) return "Este evento já aconteceu.";
  if (e.audience === "COUPLES" && !isCouple(viewer.profileType)) return "Evento exclusivo para perfis de casal.";
  return null;
}
