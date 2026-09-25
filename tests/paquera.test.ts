import { describe, expect, it } from "vitest";
import { PAQUERA, candidateOrder, isMatch, likeError } from "@/lib/paquera";

const v = (id: string, ok = true) => ({ id, ageVerification: ok ? "APPROVED" : "NONE", status: "ACTIVE" });

describe("paquera", () => {
  it("só verificados, nunca a si mesmo, sem bloqueio e com limite diário", () => {
    expect(likeError(v("a"), v("b"), false, 0)).toBeNull();
    expect(likeError(v("a"), v("a"), false, 0)).toMatch(/si mesmo/);
    expect(likeError(v("a", false), v("b"), false, 0)).toMatch(/Verifique/);
    expect(likeError(v("a"), v("b", false), false, 0)).toMatch(/indisponível/);
    expect(likeError(v("a"), v("b"), true, 0)).toMatch(/indisponível/);
    expect(likeError(v("a"), { ...v("b"), status: "BANNED" }, false, 0)).toMatch(/indisponível/);
    expect(likeError(v("a"), v("b"), false, PAQUERA.likesPerDay)).toMatch(/limite/);
  });
  it("match só quando é recíproco", () => {
    expect(isMatch(true, true)).toBe(true);
    expect(isMatch(true, false)).toBe(false);
  });
  it("mesmo estado primeiro, depois quem entrou por último", () => {
    const d = (m: number) => new Date(2026, 0, 1, 0, m);
    const out = candidateOrder([
      { id: "rj-novo", state: "RJ", lastSeenAt: d(50) },
      { id: "sp-velho", state: "SP", lastSeenAt: d(1) },
      { id: "sp-novo", state: "SP", lastSeenAt: d(40) },
    ], "SP");
    expect(out.map((x) => x.id)).toEqual(["sp-novo", "sp-velho", "rj-novo"]);
  });
});
