import { describe, expect, it } from "vitest";
import { can, onlineSortKey, type Actor } from "@/lib/permissions";

const a = (role: Actor["role"], platformRole: Actor["platformRole"] = "USER"): Actor => ({ role, platformRole });
const OWNER = a("OWNER"), MOD = a("MODERATOR"), MEMBER = a("MEMBER"), GUEST = a("GUEST");
const ADMIN = a("GUEST", "ADMIN"), PMOD = a("GUEST", "MODERATOR");

describe("permissões de sala", () => {
  it("todos podem enviar mensagem", () => {
    for (const x of [OWNER, MOD, MEMBER, GUEST]) expect(can(x, "send")).toBe(true);
  });
  it("membro e convidado não moderam", () => {
    for (const act of ["mute", "kick", "ban", "clear", "pin", "delete_message", "set_slowmode"] as const) {
      expect(can(MEMBER, act, GUEST)).toBe(false);
      expect(can(GUEST, act, GUEST)).toBe(false);
    }
  });
  it("moderador pune membro/convidado, mas não outro moderador nem o dono", () => {
    expect(can(MOD, "ban", MEMBER)).toBe(true);
    expect(can(MOD, "mute", GUEST)).toBe(true);
    expect(can(MOD, "ban", MOD)).toBe(false);
    expect(can(MOD, "kick", OWNER)).toBe(false);
  });
  it("só o dono edita sala e promove/rebaixa moderador", () => {
    expect(can(MOD, "edit_room")).toBe(false);
    expect(can(OWNER, "edit_room")).toBe(true);
    expect(can(OWNER, "promote_moderator", MEMBER)).toBe(true);
    expect(can(OWNER, "promote_moderator", MOD)).toBe(false);
    expect(can(MOD, "promote_moderator", MEMBER)).toBe(false);
    expect(can(OWNER, "demote_moderator", MOD)).toBe(true);
    expect(can(OWNER, "demote_moderator", MEMBER)).toBe(false);
  });
  it("dono pune moderador", () => {
    expect(can(OWNER, "ban", MOD)).toBe(true);
  });
  it("staff da plataforma pode tudo, exceto moderador contra admin", () => {
    expect(can(PMOD, "ban", OWNER)).toBe(true);
    expect(can(ADMIN, "delete_room")).toBe(true);
    expect(can(PMOD, "ban", a("MEMBER", "ADMIN"))).toBe(false);
    expect(can(OWNER, "ban", a("MEMBER", "ADMIN"))).toBe(false);
    expect(can(ADMIN, "ban", a("MEMBER", "ADMIN"))).toBe(true);
  });
  it("dono não pode ser alvo de dono/mod comuns", () => {
    expect(can(OWNER, "ban", OWNER)).toBe(false);
  });
  it("lista de online ordena por cargo antes de poder", () => {
    expect(onlineSortKey("MODERATOR", 0)).toBeGreaterThan(onlineSortKey("MEMBER", 999_999));
    expect(onlineSortKey("MEMBER", 50)).toBeGreaterThan(onlineSortKey("MEMBER", 10));
  });
});
