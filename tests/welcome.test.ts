import { describe, expect, it } from "vitest";
import { WELCOME, coinsValueCents, slotsLeft } from "@/lib/welcome";

const PACKAGES = [
  { name: "Tempero", coins: 300, bonusCoins: 30, priceCents: 2490 },
  { name: "Pitada", coins: 100, bonusCoins: 0, priceCents: 990 },
  { name: "Vulcão", coins: 1600, bonusCoins: 400, priceCents: 9990 },
];

describe("bônus de boas-vindas", () => {
  it("500 pimentas valem R$ 49,50 pelo pacote base", () => {
    expect(coinsValueCents(WELCOME.coins, PACKAGES)).toBe(4950);
  });
  it("ignora pacotes inativos e sem pacote não inventa valor", () => {
    expect(coinsValueCents(500, [{ coins: 100, bonusCoins: 0, priceCents: 990, active: false }, { coins: 300, bonusCoins: 0, priceCents: 2490 }])).toBe(4150);
    expect(coinsValueCents(500, [])).toBeNull();
  });
  it("vagas restantes nunca negativas", () => {
    expect(slotsLeft(0)).toBe(25);
    expect(slotsLeft(20)).toBe(5);
    expect(slotsLeft(30)).toBe(0);
  });
});
