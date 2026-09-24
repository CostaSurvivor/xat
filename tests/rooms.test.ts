import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
const { roomIsActive } = await import("@/server/rooms");
const { chatRole } = await import("@/components/RoleIcon");

const future = new Date(Date.now() + 86400_000);
const past = new Date(Date.now() - 86400_000);
const owner = (role: string, vipUntil: Date | null, status = "ACTIVE") => ({ role, vipUntil, status });

describe("sala ativa só com assinatura do dono", () => {
  it("oficial e sem dono ficam sempre ativas", () => {
    expect(roomIsActive({ isOfficial: true, owner: owner("USER", null) })).toBe(true);
    expect(roomIsActive({ isOfficial: false, owner: null })).toBe(true);
  });
  it("dono assinante: ativa; assinatura vencida: inativa", () => {
    expect(roomIsActive({ isOfficial: false, owner: owner("USER", future) })).toBe(true);
    expect(roomIsActive({ isOfficial: false, owner: owner("USER", past) })).toBe(false);
    expect(roomIsActive({ isOfficial: false, owner: owner("USER", null) })).toBe(false);
  });
  it("dono admin/moderação: sempre ativa; dono banido: inativa", () => {
    expect(roomIsActive({ isOfficial: false, owner: owner("ADMIN", null) })).toBe(true);
    expect(roomIsActive({ isOfficial: false, owner: owner("USER", future, "BANNED") })).toBe(false);
  });
});

describe("bonequinho por cargo", () => {
  it("cargo da plataforma vence o da sala", () => {
    expect(chatRole("ADMIN", "MEMBER")).toBe("ADMIN");
    expect(chatRole("MODERATOR", undefined)).toBe("STAFF");
    expect(chatRole("USER", "OWNER")).toBe("OWNER");
    expect(chatRole("USER", undefined)).toBe("GUEST");
  });
});
