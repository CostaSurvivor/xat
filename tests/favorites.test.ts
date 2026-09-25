import { describe, expect, it } from "vitest";
import { FAVORITES, cleanNote, favoriteError } from "@/lib/favorites";

describe("favoritos", () => {
  it("anotação: limpa, limita e vazia vira null", () => {
    expect(cleanNote("  casal   do clube\r\n\r\n\r\nsimpáticos ")).toEqual({ note: "casal do clube\n\nsimpáticos" });
    expect(cleanNote("   ")).toEqual({ note: null });
    expect(cleanNote(null)).toEqual({ note: null });
    expect(cleanNote("a".repeat(FAVORITES.noteMax + 1))).toHaveProperty("error");
  });
  it("não favorita a si mesmo, bloqueados nem além do limite", () => {
    expect(favoriteError("a", "a", 0, false)).toMatch(/próprio/);
    expect(favoriteError("a", "b", 0, true)).toBe("Indisponível");
    expect(favoriteError("a", "b", FAVORITES.max, false)).toMatch(/Limite/);
    expect(favoriteError("a", "b", 3, false)).toBeNull();
  });
});
