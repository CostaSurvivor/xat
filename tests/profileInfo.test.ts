import { describe, expect, it } from "vitest";
import { birthBounds, completeness, lastSeenLabel, memberSince, parseAgeRange, personsLine } from "@/lib/profileInfo";
import { ageOn } from "@/lib/age";

const NOW = Date.UTC(2026, 9, 17, 15, 0);
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000, H = 60 * MIN, D = 24 * H;

describe("lastSeenLabel", () => {
  it("faixas de tempo", () => {
    expect(lastSeenLabel(null, NOW)).toBeNull();
    expect(lastSeenLabel(ago(2 * MIN), NOW)).toBe("online agora");
    expect(lastSeenLabel(ago(17 * MIN), NOW)).toBe("visto há 17 min");
    expect(lastSeenLabel(ago(3 * H), NOW)).toBe("visto há 3 h");
    expect(lastSeenLabel(ago(30 * H), NOW)).toBe("visto ontem");
    expect(lastSeenLabel(ago(6 * D), NOW)).toBe("visto há 6 dias");
    expect(lastSeenLabel(ago(60 * D), NOW)).toBe("visto há mais de 1 mês");
  });
});

describe("memberSince", () => {
  const now = new Date(NOW);
  it("dias, meses e anos", () => {
    expect(memberSince(ago(2 * H), now)).toBe("Membro desde hoje");
    expect(memberSince(ago(3 * D), now)).toBe("Membro há 3 dias");
    expect(memberSince(new Date(Date.UTC(2026, 6, 1)), now)).toBe("Membro há 3 meses");
    expect(memberSince(new Date(Date.UTC(2025, 9, 1)), now)).toBe("Membro há 1 ano");
    expect(memberSince(new Date(Date.UTC(2023, 0, 1)), now)).toBe("Membro há 3 anos");
  });
});

describe("personsLine", () => {
  const now = new Date(NOW);
  it("casal e pessoa sozinha", () => {
    expect(personsLine([{ label: "Ele", birthDate: new Date(Date.UTC(1992, 0, 1)), orientation: "Hétero" }, { label: "Ela", birthDate: new Date(Date.UTC(1995, 0, 1)), orientation: "Bi" }], now)).toBe("Ele 34 Hétero · Ela 31 Bi");
    expect(personsLine([{ label: "Ela", birthDate: new Date(Date.UTC(1990, 11, 31)), orientation: null }], now)).toBe("35 anos");
  });
});

describe("faixa de idade", () => {
  it("parse", () => {
    expect(parseAgeRange("25", "40")).toEqual({ min: 25, max: 40 });
    expect(parseAgeRange("40", "25")).toEqual({ min: 25, max: 40 });
    expect(parseAgeRange("10", "x")).toEqual({ min: null, max: null });
    expect(parseAgeRange(undefined, "")).toEqual({ min: null, max: null });
  });
  it("limites de nascimento batem com ageOn", () => {
    const now = new Date(NOW);
    const b = birthBounds(25, 40, now);
    const inRange = (birth: Date) => (!b.gt || birth > b.gt) && (!b.lte || birth <= b.lte);
    for (const age of [24, 25, 33, 40, 41]) {
      // aniversário hoje e amanhã
      for (const dd of [0, 1]) {
        const birth = new Date(Date.UTC(2026 - age, 9, 17 + dd));
        expect(inRange(birth), `idade ${ageOn(birth, now)}`).toBe(ageOn(birth, now) >= 25 && ageOn(birth, now) <= 40);
      }
    }
  });
});

describe("completeness", () => {
  const base = { avatarId: null, bio: null, city: null, likes: [], ageVerification: "NONE", persons: [{ orientation: null, body: null }], posts: 0 };
  it("vazio e cheio", () => {
    expect(completeness(base)).toMatchObject({ pct: 0, missing: 7 });
    expect(completeness(base).next?.href).toBe("/perfil");
    const full = { avatarId: "a", bio: "Casal discreto e animado de POA.", city: "POA", likes: ["a", "b", "c"], ageVerification: "APPROVED", persons: [{ orientation: "Bi", body: "Normal" }], posts: 2 };
    expect(completeness(full)).toEqual({ pct: 100, next: null, missing: 0 });
  });
});
