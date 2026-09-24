import { describe, expect, it } from "vitest";
import { compileStyle, parseItemConfig } from "@/lib/items";
import { crc16, pixPayload } from "@/lib/pix";

describe("itens: CSS só a partir de primitivas seguras", () => {
  it("rejeita tentativa de injeção de CSS na config", () => {
    expect(parseItemConfig("GLOW", { colors: ["red;background:url(javascript:alert(1))"], animation: "none" }).success).toBe(false);
    expect(parseItemConfig("NICK_COLOR", { colors: ["#fff</style><script>"] }).success).toBe(false);
    expect(parseItemConfig("GLOW", { colors: ["#ffffff"], animation: "evil" }).success).toBe(false);
    expect(parseItemConfig("BADGE", { emoji: "<img src=x onerror=alert(1)>" }).success).toBe(false);
  });
  it("config inválida vinda do banco é ignorada na compilação", () => {
    const s = compileStyle([{ category: "NICK_COLOR", config: { colors: ["expression(alert(1))"] }, powerScore: 99 }]);
    expect(s.nick).toEqual({});
    expect(s.power).toBe(0);
  });
  it("compila glow, badges, poderes e soma poder", () => {
    const s = compileStyle([
      { category: "GLOW", config: { colors: ["#d4af37"], animation: "pulse" }, powerScore: 10 },
      { category: "BADGE", config: { emoji: "👑" }, powerScore: 25 },
      { category: "POWER", config: { power: "INVISIBLE" }, powerScore: 0 },
    ]);
    expect(s.nick.textShadow).toContain("#d4af37");
    expect(s.nickClass).toBe("fx-pulse");
    expect(s.badges).toEqual(["👑"]);
    expect(s.powers.has("INVISIBLE")).toBe(true);
    expect(s.power).toBe(35);
  });
});

describe("Pix copia e cola (BR Code)", () => {
  it("CRC16-CCITT confere com vetor conhecido", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("gera payload com valor, txid e CRC válido", () => {
    const p = pixPayload({ key: "email@exemplo.com", name: "Loja Ção", city: "São Paulo", amountCents: 2490, txid: "PABC1234" });
    expect(p.startsWith("000201")).toBe(true);
    expect(p).toContain("br.gov.bcb.pix");
    expect(p).toContain("540524.90");
    expect(p).toContain("5908LOJA CAO");
    expect(p).toContain("0508PABC1234");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
});

describe("poder fixar mensagem", () => {
  it("é um poder válido do catálogo e aparece nos poderes ativos", () => {
    expect(parseItemConfig("POWER", { power: "PIN_MESSAGE" })).toBeTruthy();
    const s = compileStyle([{ category: "POWER", config: { power: "PIN_MESSAGE" }, powerScore: 15 }]);
    expect(s.powers).toContain("PIN_MESSAGE");
  });
});
