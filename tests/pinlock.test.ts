import { describe, expect, it } from "vitest";
import { isLocked, lockMinutes, pinError, safeNext } from "@/lib/pinlock";

describe("PIN", () => {
  it("aceita 4 a 6 números e recusa fáceis", () => {
    expect(pinError("2580")).toBeNull();
    expect(pinError("739164")).toBeNull();
    expect(pinError("123")).not.toBeNull();
    expect(pinError("1234567")).not.toBeNull();
    expect(pinError("12a4")).not.toBeNull();
    expect(pinError("1111")).not.toBeNull();
    expect(pinError("1234")).not.toBeNull();
    expect(pinError("987654")).not.toBeNull();
    expect(pinError(null)).not.toBeNull();
  });
  it("tempo: só as opções válidas", () => {
    expect(lockMinutes("15")).toBe(15);
    expect(lockMinutes("7")).toBe(5);
    expect(lockMinutes(undefined)).toBe(5);
  });
});

describe("travamento", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const u = { pinHash: "x", pinLockMinutes: 5 };
  it("sem PIN nunca trava", () => {
    expect(isLocked({ pinHash: null, pinLockMinutes: 5 }, { lockedAt: new Date(), lastActiveAt: null }, now)).toBe(false);
  });
  it("trava à mão ou parado demais", () => {
    expect(isLocked(u, { lockedAt: new Date(now), lastActiveAt: new Date(now) }, now)).toBe(true);
    expect(isLocked(u, { lockedAt: null, lastActiveAt: new Date(now - 4 * 60_000) }, now)).toBe(false);
    expect(isLocked(u, { lockedAt: null, lastActiveAt: new Date(now - 6 * 60_000) }, now)).toBe(true);
    expect(isLocked(u, { lockedAt: null, lastActiveAt: null }, now)).toBe(false);
  });
  it("destino depois de desbloquear só interno", () => {
    expect(safeNext("/contos/abc")).toBe("/contos/abc");
    expect(safeNext("//evil.com")).toBe("/feed");
    expect(safeNext("https://evil.com")).toBe("/feed");
    expect(safeNext("/\\evil.com")).toBe("/feed");
    expect(safeNext("/desbloquear")).toBe("/feed");
  });
});
