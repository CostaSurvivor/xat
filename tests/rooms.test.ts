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

describe("fotos na sala: regra do dono", async () => {
  const { canSendRoomPhoto } = await import("@/server/rooms");
  const a = (role: "OWNER" | "MODERATOR" | "MEMBER" | "GUEST", platformRole: "USER" | "ADMIN" = "USER") => ({ role, platformRole });
  it("não verificado nunca envia (exceto staff)", () => {
    expect(canSendRoomPhoto({ mediaPolicy: "VERIFIED" }, a("OWNER"), false)).toBe(false);
    expect(canSendRoomPhoto({ mediaPolicy: "NOBODY" }, a("GUEST", "ADMIN"), false)).toBe(true);
  });
  it("respeita a política", () => {
    expect(canSendRoomPhoto({ mediaPolicy: "NOBODY" }, a("OWNER"), true)).toBe(false);
    expect(canSendRoomPhoto({ mediaPolicy: "MODS" }, a("MODERATOR"), true)).toBe(true);
    expect(canSendRoomPhoto({ mediaPolicy: "MODS" }, a("MEMBER"), true)).toBe(false);
    expect(canSendRoomPhoto({ mediaPolicy: "MEMBERS" }, a("MEMBER"), true)).toBe(true);
    expect(canSendRoomPhoto({ mediaPolicy: "MEMBERS" }, a("GUEST"), true)).toBe(false);
    expect(canSendRoomPhoto({ mediaPolicy: "VERIFIED" }, a("GUEST"), true)).toBe(true);
  });
});
