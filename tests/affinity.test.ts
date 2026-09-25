import { describe, expect, it } from "vitest";
import { affinity, affinityTier, tagsOf } from "@/lib/affinity";

describe("afinidade", () => {
  it("ignora itens desconhecidos e repetidos", () => {
    expect(tagsOf(["Soft swing", "Soft swing", "Viagens", 3, null])).toEqual(["Soft swing"]);
    expect(tagsOf(null)).toEqual([]);
    expect(tagsOf("Soft swing")).toEqual([]);
  });
  it("precisa de pelo menos 2 itens de cada lado", () => {
    expect(affinity(["Soft swing"], ["Soft swing", "Voyeur"])).toBeNull();
    expect(affinity(["Soft swing", "Voyeur"], [])).toBeNull();
  });
  it("calcula e lista o que têm em comum", () => {
    expect(affinity(["Soft swing", "Voyeur"], ["Voyeur", "Soft swing"])).toEqual({ pct: 100, common: ["Soft swing", "Voyeur"] });
    expect(affinity(["Soft swing", "Voyeur"], ["Cuckold", "Hotwife"])).toEqual({ pct: 0, common: [] });
    // 2·2 / (3+4) = 57% -> 55
    expect(affinity(["Soft swing", "Voyeur", "Nudismo"], ["Soft swing", "Voyeur", "Cuckold", "Hotwife"])?.pct).toBe(55);
  });
  it("é simétrica", () => {
    const a = ["Soft swing", "Casa de swing", "Festas liberais"], b = ["Soft swing", "Festas liberais", "Voyeur", "Nudismo", "Hétero"];
    expect(affinity(a, b)?.pct).toBe(affinity(b, a)?.pct);
  });
  it("faixas", () => {
    expect(affinityTier(80).label).toBe("Afinidade alta");
    expect(affinityTier(50).label).toBe("Boa afinidade");
    expect(affinityTier(10).label).toBe("Pouca afinidade");
  });
});
