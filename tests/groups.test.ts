import { describe, expect, it } from "vitest";
import { DEFAULT_GROUPS, canSeeGroup, groupSchema, joinError } from "@/lib/groups";

const open = { audience: "ALL", archivedAt: null };
const couples = { audience: "COUPLES", archivedAt: null };
const single = { profileType: "SINGLE_MAN", role: "USER" };
const couple = { profileType: "COUPLE_MF", role: "USER" };
const mod = { profileType: "SINGLE_MAN", role: "MODERATOR" };

describe("grupos", () => {
  it("grupo aberto: todos veem e entram", () => {
    expect(canSeeGroup(open, single)).toBe(true);
    expect(joinError(open, single)).toBeNull();
  });
  it("só casais: solteiro não vê nem entra; casal e equipe sim", () => {
    expect(canSeeGroup(couples, single)).toBe(false);
    expect(joinError(couples, single)).toMatch(/casal/);
    expect(canSeeGroup(couples, couple)).toBe(true);
    expect(joinError(couples, couple)).toBeNull();
    expect(canSeeGroup(couples, mod)).toBe(true);
  });
  it("arquivado: só a equipe vê; ninguém entra", () => {
    const arch = { ...open, archivedAt: new Date() };
    expect(canSeeGroup(arch, couple)).toBe(false);
    expect(canSeeGroup(arch, mod)).toBe(true);
    expect(joinError(arch, mod)).toMatch(/arquivado/);
  });
  it("grupos iniciais são válidos e com endereço único", () => {
    for (const g of DEFAULT_GROUPS) expect(groupSchema.safeParse(g).success).toBe(true);
    expect(new Set(DEFAULT_GROUPS.map((g) => g.slug)).size).toBe(DEFAULT_GROUPS.length);
    expect(groupSchema.safeParse({ ...DEFAULT_GROUPS[0], slug: "../x" }).success).toBe(false);
  });
});
