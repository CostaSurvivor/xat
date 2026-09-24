import { describe, expect, it } from "vitest";
import { ownerTransition, testimonialSchema, writeError } from "@/lib/testimonials";

const a = { id: "a", ageVerification: "APPROVED", status: "ACTIVE" };
const b = { id: "b", ageVerification: "NONE", status: "ACTIVE" };

describe("depoimentos", () => {
  it("só perfil verificado escreve, nunca para si, e nunca com bloqueio", () => {
    expect(writeError(a, b, false)).toBeNull();
    expect(writeError(b, a, false)).toMatch(/Verifique/);
    expect(writeError(a, a, false)).toMatch(/si mesmo/);
    expect(writeError(a, b, true)).toBe("Indisponível");
    expect(writeError(a, { ...b, status: "BANNED" }, false)).toBe("Indisponível");
  });
  it("texto: tamanho, sem links e sem telefone", () => {
    const ok = (body: string) => testimonialSchema.safeParse({ body, metInPerson: true }).success;
    expect(ok("Casal nota 10, super educados e respeitosos!")).toBe(true);
    expect(ok("curto")).toBe(false);
    expect(ok("x".repeat(801))).toBe(false);
    expect(ok("Nos achem em www.exemplo.com, casal top demais")).toBe(false);
    expect(ok("Casal top, chama no zap 11 98765-4321 pra marcar")).toBe(false);
  });
  it("dono aprova ou oculta; repetir a mesma ação não muda nada", () => {
    expect(ownerTransition("approve", "PENDING")).toBe("APPROVED");
    expect(ownerTransition("hide", "APPROVED")).toBe("HIDDEN");
    expect(ownerTransition("approve", "HIDDEN")).toBe("APPROVED");
    expect(ownerTransition("approve", "APPROVED")).toBeNull();
    expect(ownerTransition("nada", "PENDING")).toBeNull();
  });
});

import { CONFIRMED_MIN, isConfirmed } from "@/lib/testimonials";
describe("selo Confirmado", () => {
  it("precisa de 3 depoimentos presenciais", () => {
    expect(CONFIRMED_MIN).toBe(3);
    expect(isConfirmed(2)).toBe(false);
    expect(isConfirmed(3)).toBe(true);
  });
});
