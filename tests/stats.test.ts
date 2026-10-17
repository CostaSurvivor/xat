import { describe, expect, it } from "vitest";
import { dailySeries, summarize } from "@/lib/stats";

describe("dailySeries", () => {
  it("preenche dias vazios e termina hoje", () => {
    const s = dailySeries([{ day: "2026-10-15", value: 3 }, { day: "2026-10-17", value: 1 }], "2026-10-17", 4);
    expect(s).toEqual([
      { day: "2026-10-14", value: 0 },
      { day: "2026-10-15", value: 3 },
      { day: "2026-10-16", value: 0 },
      { day: "2026-10-17", value: 1 },
    ]);
  });
});

describe("summarize", () => {
  it("hoje, 7, 30 e variação", () => {
    const s = Array.from({ length: 30 }, (_, i) => ({ value: i >= 23 ? 2 : i >= 16 ? 1 : 0 }));
    expect(summarize(s)).toEqual({ today: 2, d7: 14, d30: 21, deltaPct: 100 });
  });
  it("sem semana anterior não inventa %", () => {
    const s = Array.from({ length: 30 }, (_, i) => ({ value: i === 29 ? 5 : 0 }));
    expect(summarize(s).deltaPct).toBeNull();
  });
  it("queda", () => {
    const s = Array.from({ length: 30 }, (_, i) => ({ value: i >= 23 ? 3 : i >= 16 ? 5 : 0 }));
    expect(summarize(s).deltaPct).toBe(-40);
  });
});
