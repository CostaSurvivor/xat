import { describe, expect, it } from "vitest";
import { REGIONS, UFS, defaultStateDescription, regionOf, stateRoom } from "@/lib/config";

describe("regiões das salas", () => {
  it("cada UF está em exatamente uma região", () => {
    const all = REGIONS.flatMap((r) => r.ufs as readonly string[]);
    expect([...all].sort()).toEqual([...UFS].sort());
    expect(new Set(all).size).toBe(UFS.length);
  });
  it("Sul: RS, SC e PR; RS com descrição gaúcha", () => {
    expect(regionOf("RS")?.name).toBe("Sul");
    expect(regionOf("PR")?.key).toBe("SUL");
    expect(regionOf(null)).toBeUndefined();
    expect(stateRoom("RS").description).toMatch(/tchê/);
    expect(stateRoom("BA").description).toBe(defaultStateDescription("BA"));
  });
});
