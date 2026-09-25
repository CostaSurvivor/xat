import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, evaluate, nextGoals, type AchStats } from "@/lib/achievements";

const zero: AchStats = { verified: false, posts: 0, friends: 0, followers: 0, contos: 0, invites: 0, streak: 0, events: 0, testimonials: 0, ageDays: 0 };

describe("conquistas", () => {
  it("conta nova não tem nenhuma", () => {
    expect(evaluate(zero).filter((a) => a.done)).toEqual([]);
  });
  it("marca as cumpridas e limita o progresso à meta", () => {
    const r = evaluate({ ...zero, verified: true, posts: 3, contos: 7, invites: 6 });
    const done = r.filter((a) => a.done).map((a) => a.key);
    expect(done).toEqual(["verificado", "primeiro-post", "contista", "escritor", "anfitriao"]);
    expect(r.find((a) => a.key === "escritor")?.progress).toBe(5);
    expect(r.find((a) => a.key === "embaixador")?.progress).toBe(6);
  });
  it("próximas metas: as mais perto de completar", () => {
    const r = evaluate({ ...zero, friends: 9, streak: 2, followers: 1 });
    expect(nextGoals(r, 2).map((a) => a.key)).toEqual(["amigos", "fiel"]);
  });
  it("chaves únicas", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
  });
});
