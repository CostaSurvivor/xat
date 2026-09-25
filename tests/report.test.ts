import { describe, expect, it } from "vitest";
import { brDay, compact, delta, fillDays, niceScale, parsePeriod, shortDay } from "@/lib/report";

describe("relatório do admin", () => {
  it("período aceita só 7, 30 ou 90", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("999")).toBe(7);
    expect(parsePeriod(undefined)).toBe(7);
  });
  it("dia no horário de Brasília", () => {
    expect(brDay(new Date("2026-09-25T02:00:00Z"))).toBe("2026-09-24");
    expect(brDay(new Date("2026-09-25T04:00:00Z"))).toBe("2026-09-25");
  });
  it("série diária contínua com zeros", () => {
    const s = fillDays([{ day: "2026-09-23", value: 5 }], 3, new Date("2026-09-24T15:00:00Z"));
    expect(s).toEqual([{ day: "2026-09-22", value: 0 }, { day: "2026-09-23", value: 5 }, { day: "2026-09-24", value: 0 }]);
  });
  it("variação contra o período anterior", () => {
    expect(delta(15, 10)).toEqual({ pct: 50, dir: "up" });
    expect(delta(5, 10)).toEqual({ pct: -50, dir: "down" });
    expect(delta(3, 0)).toEqual({ pct: null, dir: "up" });
    expect(delta(0, 0)).toEqual({ pct: 0, dir: "flat" });
  });
  it("eixo com números redondos", () => {
    expect(niceScale(17)).toEqual({ top: 20, ticks: [0, 5, 10, 15, 20] });
    expect(niceScale(3)).toEqual({ top: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(0).top).toBe(4);
    expect(niceScale(9000).top).toBe(10000);
  });
  it("formatos", () => {
    expect(compact(1284)).toBe("1.284");
    expect(compact(12_900)).toBe("12,9 mil");
    expect(shortDay("2026-09-04")).toBe("04/09");
  });
});
