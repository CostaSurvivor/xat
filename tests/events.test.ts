import { describe, expect, it } from "vitest";
import { canCreateEvent, canSeeEvent, eventSchema, rsvpError } from "@/lib/events";

const future = (h: number) => new Date(Date.now() + h * 3600_000);
const base = { title: "Festa liberal de sexta", description: "Noite temática com DJ, open bar e muita gente bonita. Dress code: preto.", startsAt: future(48).toISOString(), endsAt: "", state: "SP", city: "São Paulo", venue: "Clube X", priceText: "R$ 100 o casal", audience: "ALL" };

describe("eventos", () => {
  it("valida evento correto e recusa datas ruins", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
    expect(eventSchema.safeParse({ ...base, startsAt: future(-5).toISOString() }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, endsAt: future(10).toISOString() }).success).toBe(false); // fim antes do início
    expect(eventSchema.safeParse({ ...base, endsAt: future(48 + 24 * 9).toISOString() }).success).toBe(false); // > 7 dias
    expect(eventSchema.safeParse({ ...base, state: "XX" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, audience: "VIP" }).success).toBe(false);
  });
  it("hora do formulário é horário de Brasília (servidor em UTC)", async () => {
    const { parseBrLocal, fmtEventDate } = await import("@/lib/events");
    const d = parseBrLocal("2030-01-10T22:00") as Date;
    expect(d.toISOString()).toBe("2030-01-11T01:00:00.000Z");
    expect(fmtEventDate(d, { hour: "2-digit", minute: "2-digit" })).toBe("22:00");
  });
  it("quem cria: equipe, ou assinante verificado", () => {
    const u = { role: "USER", ageVerification: "APPROVED", vipUntil: future(24) };
    expect(canCreateEvent(u)).toBeNull();
    expect(canCreateEvent({ ...u, vipUntil: null })).toMatch(/assinantes/);
    expect(canCreateEvent({ ...u, ageVerification: "PENDING" })).toMatch(/Verifique/);
    expect(canCreateEvent({ role: "MODERATOR", ageVerification: "NONE", vipUntil: null })).toBeNull();
  });
  it("evento em análise só aparece para o criador e a equipe", () => {
    const e = { status: "PENDING", creatorId: "c" };
    expect(canSeeEvent(e, { id: "x", role: "USER" })).toBe(false);
    expect(canSeeEvent(e, { id: "c", role: "USER" })).toBe(true);
    expect(canSeeEvent(e, { id: "x", role: "ADMIN" })).toBe(true);
    expect(canSeeEvent({ ...e, status: "APPROVED" }, { id: "x", role: "USER" })).toBe(true);
  });
  it("presença: só em aprovado, não passado, e 'só casais' exige casal", () => {
    const e = { status: "APPROVED", startsAt: future(24), endsAt: null, audience: "ALL" };
    expect(rsvpError(e, { profileType: "SINGLE_MAN" })).toBeNull();
    expect(rsvpError({ ...e, audience: "COUPLES" }, { profileType: "SINGLE_MAN" })).toMatch(/casal/);
    expect(rsvpError({ ...e, audience: "COUPLES" }, { profileType: "COUPLE_MF" })).toBeNull();
    expect(rsvpError({ ...e, status: "PENDING" }, { profileType: "COUPLE_MF" })).toMatch(/indisponível/);
    expect(rsvpError({ ...e, startsAt: future(-30) }, { profileType: "COUPLE_MF" })).toMatch(/aconteceu/);
  });
});
