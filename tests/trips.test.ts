import { describe, expect, it } from "vitest";
import { TRIPS, addDays, parseTrip, todayBR, tripDates, tripLabel, tripPhase } from "@/lib/trips";

const resolve = (c: string, uf: string) => (uf === "SC" && c.toLowerCase() === "florianopolis" ? "Florianópolis" : null);
const T = "2026-10-01";
const base = { city: "florianopolis", state: "SC", from: "2026-10-10", to: "2026-10-14", note: " casal  simpático " };

describe("parseTrip", () => {
  it("aceita e usa o nome oficial da cidade", () => {
    expect(parseTrip(base, T, resolve)).toEqual({ city: "Florianópolis", state: "SC", from: "2026-10-10", to: "2026-10-14", note: "casal simpático" });
  });
  it("recusa UF, cidade e datas inválidas", () => {
    expect(parseTrip({ ...base, state: "XX" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, city: "Nárnia" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, from: "2026-02-30" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, from: "10/10/2026" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, from: "2026-10-15" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, from: "2026-09-01", to: "2026-09-20" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, to: addDays(base.from, TRIPS.maxDays) }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, from: addDays(T, TRIPS.aheadDays + 1), to: addDays(T, TRIPS.aheadDays + 2) }, T, resolve)).toHaveProperty("error");
  });
  it("aceita viagem em andamento (ida no passado, volta no futuro) e 30 dias exatos", () => {
    expect(parseTrip({ ...base, from: "2026-09-28", to: "2026-10-03" }, T, resolve)).not.toHaveProperty("error");
    expect(parseTrip({ ...base, to: addDays(base.from, TRIPS.maxDays - 1) }, T, resolve)).not.toHaveProperty("error");
  });
  it("recusa contato na observação", () => {
    expect(parseTrip({ ...base, note: "chama no 11 99999-8888" }, T, resolve)).toHaveProperty("error");
    expect(parseTrip({ ...base, note: "www.site.com" }, T, resolve)).toHaveProperty("error");
  });
});

describe("fases e textos", () => {
  it("fase da viagem", () => {
    expect(tripPhase({ from: "2026-09-28", to: "2026-10-03" }, T)).toBe("now");
    expect(tripPhase({ from: "2026-10-10", to: "2026-10-14" }, T)).toBe("soon");
    expect(tripPhase({ from: "2026-12-10", to: "2026-12-14" }, T)).toBe("later");
    expect(tripPhase({ from: "2026-09-10", to: "2026-09-14" }, T)).toBe("past");
  });
  it("datas curtas", () => {
    expect(tripDates("2026-10-10", "2026-10-14")).toBe("10 a 14/out");
    expect(tripDates("2026-09-28", "2026-10-02")).toBe("28/set a 2/out");
    expect(tripDates("2026-10-10", "2026-10-10")).toBe("10/out");
    expect(tripLabel({ city: "Florianópolis", state: "SC", from: "2026-09-28", to: "2026-10-03" }, T)).toBe("✈️ Em Florianópolis/SC até 3/out");
    expect(tripLabel({ city: "Florianópolis", state: "SC", from: "2026-10-10", to: "2026-10-14" }, T)).toBe("✈️ Vai para Florianópolis/SC · 10 a 14/out");
  });
  it("hoje no horário de Brasília", () => {
    expect(todayBR(Date.parse("2026-10-02T02:00:00Z"))).toBe("2026-10-01");
    expect(todayBR(Date.parse("2026-10-02T04:00:00Z"))).toBe("2026-10-02");
  });
});
