import { describe, expect, it } from "vitest";
import { AFIM, afimUntilLabel, isAfim, parseAfim } from "@/lib/afim";

const NOW = Date.UTC(2026, 8, 25, 21, 0); // 18h em Brasília

describe("parseAfim", () => {
  it("aceita horas válidas e recado vazio", () => {
    const r = parseAfim({ hours: "4", note: "  " }, NOW);
    expect(r).toEqual({ until: new Date(NOW + 4 * 3600_000), note: null });
  });
  it("recusa horas fora da lista", () => {
    expect(parseAfim({ hours: "24", note: "" }, NOW)).toHaveProperty("error");
    expect(parseAfim({ hours: "abc", note: "" }, NOW)).toHaveProperty("error");
  });
  it("limpa espaços do recado", () => {
    const r = parseAfim({ hours: 2, note: " Procurando   casal  hoje " }, NOW);
    expect(r).toMatchObject({ note: "Procurando casal hoje" });
  });
  it("recusa recado longo", () => {
    expect(parseAfim({ hours: 2, note: "a".repeat(AFIM.noteMax + 1) }, NOW)).toHaveProperty("error");
  });
  it("recusa telefone, links e redes", () => {
    for (const note of ["me chama 51 99999-8888", "(51) 9 9999 8888", "chama no whats", "insta @fulano", "wa.me/5551", "www.site.com"])
      expect(parseAfim({ hours: 2, note }, NOW), note).toHaveProperty("error");
  });
  it("recusa programa e pagamento", () => {
    for (const note of ["faço programa", "cachê a combinar", "R$ 200", "aceito pix", "acompanhante hoje"])
      expect(parseAfim({ hours: 2, note }, NOW), note).toHaveProperty("error");
  });
  it("recusa menores", () => {
    expect(parseAfim({ hours: 2, note: "procuro novinha de 16 anos" }, NOW)).toHaveProperty("error");
  });
  it("aceita recado comum", () => {
    expect(parseAfim({ hours: 8, note: "Casal no centro de POA, topa um drink?" }, NOW)).not.toHaveProperty("error");
  });
});

describe("isAfim / afimUntilLabel", () => {
  it("vale só até a hora marcada", () => {
    expect(isAfim({ afimUntil: null }, NOW)).toBe(false);
    expect(isAfim({ afimUntil: new Date(NOW + 1000) }, NOW)).toBe(true);
    expect(isAfim({ afimUntil: new Date(NOW - 1000) }, NOW)).toBe(false);
  });
  it("mostra a hora de Brasília", () => {
    expect(afimUntilLabel(new Date(NOW + 4 * 3600_000))).toBe("até 22h");
    expect(afimUntilLabel(new Date(NOW + 30 * 60_000))).toBe("até 18h30");
  });
});
