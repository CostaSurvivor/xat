import { describe, expect, it } from "vitest";
import { pickSuggestions, suggestionScore } from "@/lib/suggestions";

const NOW = Date.UTC(2026, 9, 17);
const base = { likes: [], avatarId: null, ageVerification: "NONE", lastSeenAt: null, createdAt: new Date(NOW - 100 * 86_400_000) };
const v = { state: "RS", likes: ["Soft swing", "Voyeur", "Hotwife"] };

describe("sugestões", () => {
  it("mesmo estado, foto, verificado e afinidade somam", () => {
    const plain = suggestionScore(v, { id: "a", state: "SP", ...base }, NOW);
    const good = suggestionScore(v, { id: "b", state: "RS", ...base, avatarId: "m", ageVerification: "APPROVED", likes: ["Soft swing", "Voyeur", "Hotwife"] }, NOW);
    expect(good).toBeGreaterThan(plain + 5);
  });
  it("ordena e corta", () => {
    const list = [
      { id: "longe", state: "AM", ...base },
      { id: "perto", state: "RS", ...base, avatarId: "x" },
      { id: "ativo", state: "SP", ...base, lastSeenAt: new Date(NOW - 3600_000) },
    ];
    expect(pickSuggestions(v, list, 2, NOW).map((c) => c.id)).toEqual(["perto", "ativo"]);
  });
});
