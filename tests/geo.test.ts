import { describe, expect, it } from "vitest";
import { boundingBox, cityCoords, citiesOf, distanceLabel, haversineKm, normalizeCity, roundCoord, validLatLng } from "@/lib/geo";

describe("proximidade", () => {
  it("acha cidades com ou sem acento e ignora maiúsculas", () => {
    expect(cityCoords("São Paulo", "SP")).not.toBeNull();
    expect(cityCoords("sao paulo", "SP")).toEqual(cityCoords("São Paulo", "SP"));
    expect(cityCoords("  ARAÇATUBA ", "SP")).not.toBeNull();
    expect(cityCoords("Birigui", "SP")).not.toBeNull();
    expect(cityCoords("São Paulo", "RJ")).toBeNull(); // UF errada
    expect(cityCoords("Cidade Inventada", "SP")).toBeNull();
    expect(normalizeCity("São José dos Campos")).toBe("sao jose dos campos");
  });
  it("tem todos os municípios e distâncias conhecidas batem", () => {
    expect(citiesOf("SP").length).toBeGreaterThan(640);
    const sp = cityCoords("São Paulo", "SP")!, rj = cityCoords("Rio de Janeiro", "RJ")!;
    const d = haversineKm(sp, rj);
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(370);
    const ara = cityCoords("Araçatuba", "SP")!, bir = cityCoords("Birigui", "SP")!;
    expect(haversineKm(ara, bir)).toBeLessThan(25);
  });
  it("distância só em faixas e coordenada arredondada (~1 km)", () => {
    expect(distanceLabel(0.3)).toBe("até 5 km");
    expect(distanceLabel(12.1)).toBe("~15 km");
    expect(distanceLabel(73)).toBe("~80 km");
    expect(distanceLabel(361)).toBe("~400 km");
    expect(roundCoord(-23.550520)).toBe(-23.55);
    expect(validLatLng(-23.5, -46.6)).toBe(true);
    expect(validLatLng(48.8, 2.3)).toBe(false); // fora do Brasil
    expect(validLatLng(NaN, 1)).toBe(false);
  });
  it("caixa de busca contém o raio", () => {
    const sp = cityCoords("São Paulo", "SP")!;
    const b = boundingBox(sp, 50);
    expect(b.maxLat - b.minLat).toBeCloseTo(100 / 111, 2);
    expect(b.minLng).toBeLessThan(sp.lng);
  });
});
