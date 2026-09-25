import { describe, expect, it } from "vitest";
import { avgStars, parsePlace, parseReview, ratingDelta, starsText } from "@/lib/places";

const ok = { name: "Clube Sensações", kind: "CLUBE", state: "RS", city: "Porto Alegre", address: "Rua X, 100", site: "www.sensacoes.com.br", description: "Casa de swing tradicional." };

describe("parsePlace", () => {
  it("aceita e normaliza o site", () => {
    const r = parsePlace(ok);
    expect(r).toMatchObject({ name: "Clube Sensações", kind: "CLUBE", site: "https://www.sensacoes.com.br/" });
  });
  it("recusa campos inválidos", () => {
    expect(parsePlace({ ...ok, name: "ab" })).toHaveProperty("error");
    expect(parsePlace({ ...ok, kind: "IGREJA" })).toHaveProperty("error");
    expect(parsePlace({ ...ok, state: "XX" })).toHaveProperty("error");
    expect(parsePlace({ ...ok, site: "javascript:alert(1)" })).toHaveProperty("error");
    expect(parsePlace({ ...ok, site: "semponto" })).toHaveProperty("error");
  });
  it("site e endereço são opcionais", () => {
    expect(parsePlace({ ...ok, site: "", address: "" })).toMatchObject({ site: null, address: null });
  });
  it("recusa menores", () => {
    expect(parsePlace({ ...ok, description: "festa com novinhas de 16 anos" })).toHaveProperty("error");
  });
});

describe("parseReview", () => {
  it("estrelas de 1 a 5", () => {
    expect(parseReview({ stars: "5", body: " Ótimo! " })).toEqual({ stars: 5, body: "Ótimo!" });
    expect(parseReview({ stars: "0", body: "" })).toHaveProperty("error");
    expect(parseReview({ stars: "4.5", body: "" })).toHaveProperty("error");
  });
  it("sem telefone", () => {
    expect(parseReview({ stars: 4, body: "liga 51 99999-8888" })).toHaveProperty("error");
  });
});

describe("média e delta", () => {
  it("média com uma casa", () => {
    expect(avgStars(0, 0)).toBeNull();
    expect(avgStars(9, 2)).toBe(4.5);
    expect(starsText(4.5)).toBe("★★★★★".slice(0, 5));
    expect(starsText(3.2)).toBe("★★★☆☆");
  });
  it("delta de criar, trocar e apagar", () => {
    expect(ratingDelta(null, 4)).toEqual({ sum: 4, count: 1 });
    expect(ratingDelta(4, 2)).toEqual({ sum: -2, count: 0 });
    expect(ratingDelta(3, null)).toEqual({ sum: -3, count: -1 });
  });
});
