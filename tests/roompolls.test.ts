import { describe, expect, it } from "vitest";
import { canManagePoll, isOpen, resultLine, roomPollSchema, tally } from "@/lib/roompolls";

describe("enquetes nas salas", () => {
  it("valida pergunta, opções (2 a 5, sem repetir, sem link) e duração", () => {
    const ok = (p: object) => roomPollSchema.safeParse(p).success;
    expect(ok({ question: "Qual o melhor dia?", options: ["Sexta", "Sábado"], minutes: 5 })).toBe(true);
    expect(ok({ question: "Qual?", options: ["Só uma"], minutes: 5 })).toBe(false);
    expect(ok({ question: "Qual?", options: ["a", "b", "c", "d", "e", "f"], minutes: 5 })).toBe(false);
    expect(ok({ question: "Qual?", options: ["Sim", "sim"], minutes: 5 })).toBe(false);
    expect(ok({ question: "Qual?", options: ["www.x.com", "b"], minutes: 5 })).toBe(false);
    expect(ok({ question: "Qual?", options: ["a", "b"], minutes: 31 })).toBe(false);
  });
  it("quem gerencia: dono, moderador e equipe; membro e convidado não", () => {
    expect(canManagePoll({ role: "MODERATOR", platformRole: "USER" })).toBe(true);
    expect(canManagePoll({ role: "OWNER", platformRole: "USER" })).toBe(true);
    expect(canManagePoll({ role: "MEMBER", platformRole: "MODERATOR" })).toBe(true);
    expect(canManagePoll({ role: "MEMBER", platformRole: "USER" })).toBe(false);
    expect(canManagePoll({ role: "GUEST", platformRole: "USER" })).toBe(false);
  });
  it("aberta até o fim do prazo ou até ser encerrada", () => {
    const now = Date.now();
    expect(isOpen({ endsAt: new Date(now + 1000), closedAt: null }, now)).toBe(true);
    expect(isOpen({ endsAt: new Date(now - 1), closedAt: null }, now)).toBe(false);
    expect(isOpen({ endsAt: new Date(now + 1000), closedAt: new Date() }, now)).toBe(false);
  });
  it("contagem, porcentagem, vencedora e empate", () => {
    const t = tally([{ option: 0 }, { option: 1 }, { option: 1 }, { option: 9 }], 3);
    expect(t.counts).toEqual([1, 2, 0]);
    expect(t.pct).toEqual([33, 67, 0]);
    expect(t.winners).toEqual([1]);
    expect(resultLine("Dia?", ["Sexta", "Sábado"], [{ option: 0 }, { option: 1 }])).toMatch(/Empate: Sexta e Sábado/);
    expect(resultLine("Dia?", ["Sexta", "Sábado"], [])).toMatch(/Ninguém votou/);
  });
});
