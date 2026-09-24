import { describe, expect, it } from "vitest";
import { ageOn, allAdults, isAdult, parseBirthDate } from "@/lib/age";

const ref = new Date(Date.UTC(2026, 8, 24)); // 24/09/2026

describe("age gate", () => {
  it("calcula idade respeitando aniversário", () => {
    expect(ageOn(new Date(Date.UTC(2008, 8, 24)), ref)).toBe(18);
    expect(ageOn(new Date(Date.UTC(2008, 8, 25)), ref)).toBe(17);
  });
  it("18 anos completos no dia é adulto; um dia antes não", () => {
    expect(isAdult(new Date(Date.UTC(2008, 8, 24)), ref)).toBe(true);
    expect(isAdult(new Date(Date.UTC(2008, 8, 25)), ref)).toBe(false);
  });
  it("rejeita datas inválidas/absurdas", () => {
    expect(isAdult(new Date("x"), ref)).toBe(false);
    expect(isAdult(new Date(Date.UTC(1850, 0, 1)), ref)).toBe(false);
    expect(parseBirthDate("2000-02-30")).toBeNull();
    expect(parseBirthDate("31/12/2000")).toBeNull();
    expect(parseBirthDate("2000-12-31")?.toISOString()).toBe("2000-12-31T00:00:00.000Z");
  });
  it("casal: basta uma pessoa menor para reprovar", () => {
    const adult = new Date(Date.UTC(1990, 0, 1));
    const minor = new Date(Date.UTC(2010, 0, 1));
    expect(allAdults([adult, adult], ref)).toBe(true);
    expect(allAdults([adult, minor], ref)).toBe(false);
    expect(allAdults([], ref)).toBe(false);
  });
});
