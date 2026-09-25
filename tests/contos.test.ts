import { describe, expect, it } from "vitest";
import { CONTOS, canDeleteConto, canEditConto, excerpt, forbiddenReason, parseConto, publishError, readingMinutes } from "@/lib/contos";

const body = "Era uma noite quente na casa de swing e a gente resolveu arriscar. ".repeat(8);

describe("parseConto", () => {
  it("aceita um conto válido e limpa espaços", () => {
    const r = parseConto({ title: "  Noite   no clube ", category: "swing", body: `${body}\r\n\r\n\r\n\r\nFim.` });
    expect(r).toEqual({ title: "Noite no clube", category: "swing", body: `${body.trim()}\n\nFim.` });
  });
  it("recusa título curto, categoria inválida, texto curto ou longo", () => {
    expect(parseConto({ title: "Oi", category: "swing", body })).toHaveProperty("error");
    expect(parseConto({ title: "Título ok", category: "nada", body })).toHaveProperty("error");
    expect(parseConto({ title: "Título ok", category: "__proto__", body })).toHaveProperty("error");
    expect(parseConto({ title: "Título ok", category: "swing", body: "curto" })).toHaveProperty("error");
    expect(parseConto({ title: "Título ok", category: "swing", body: "a".repeat(CONTOS.bodyMax + 1) })).toHaveProperty("error");
  });
  it("recusa links", () => {
    expect(parseConto({ title: "Título ok", category: "swing", body: `${body} me acha em www.site.com` })).toHaveProperty("error");
    expect(parseConto({ title: "Título ok", category: "swing", body: `${body} perfil.com.br` })).toHaveProperty("error");
  });
});

describe("conteúdo proibido", () => {
  it("barra menores, falta de consentimento, incesto e zoofilia", () => {
    expect(forbiddenReason("ela era uma adolescente")).toBe("menores de idade");
    expect(forbiddenReason("uma novinha")).toBe("menores de idade");
    expect(forbiddenReason("ela tinha 16 anos")).toBe("menores de idade");
    expect(forbiddenReason("uma menina de 15 anos")).toBe("menores de idade");
    expect(forbiddenReason("aos 14 eu")).toBe("menores de idade");
    expect(forbiddenReason("ela estava dopada")).toBe("sexo sem consentimento");
    expect(forbiddenReason("foi um incesto")).toBe("incesto");
    expect(forbiddenReason("zoofilia")).toBe("zoofilia");
  });
  it("não barra idades adultas nem tempo de casados", () => {
    expect(forbiddenReason("ela tinha 32 anos e eu 40")).toBeNull();
    expect(forbiddenReason("casados há 15 anos")).toBeNull();
    expect(forbiddenReason("com 10 anos de casados")).toBeNull();
    expect(forbiddenReason("depois de 5 anos de namoro")).toBeNull();
    expect(forbiddenReason("com 3 amigos, ela estava abusada")).toBeNull();
    expect(forbiddenReason("aos 45 minutos do segundo tempo")).toBeNull();
  });
});

describe("regras de publicação", () => {
  it("exige verificação e limita por dia", () => {
    expect(publishError({ ageVerification: "PENDING" }, 0)).toMatch(/Verifique/);
    expect(publishError({ ageVerification: "APPROVED" }, CONTOS.perDay)).toMatch(/hoje/);
    expect(publishError({ ageVerification: "APPROVED" }, 0)).toBeNull();
  });
  it("edita só o autor; apaga o autor ou a equipe", () => {
    const c = { authorId: "a", deletedAt: null };
    expect(canEditConto(c, { id: "a" })).toBe(true);
    expect(canEditConto(c, { id: "b" })).toBe(false);
    expect(canDeleteConto(c, { id: "b", role: "USER" })).toBe(false);
    expect(canDeleteConto(c, { id: "b", role: "MODERATOR" })).toBe(true);
    expect(canDeleteConto({ ...c, deletedAt: new Date() }, { id: "a", role: "USER" })).toBe(false);
  });
});

describe("apresentação", () => {
  it("tempo de leitura e prévia", () => {
    expect(readingMinutes("uma palavra")).toBe(1);
    expect(readingMinutes("x ".repeat(1000))).toBe(5);
    const e = excerpt("palavra ".repeat(60), 50);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(51);
    expect(excerpt("curto")).toBe("curto");
  });
});

describe("prévia", () => {
  it("não deixa pontuação antes das reticências", () => {
    expect(excerpt("Era a noite. E depois veio mais coisa para contar aqui", 14)).toBe("Era a noite…");
  });
});
