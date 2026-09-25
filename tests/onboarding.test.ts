import { describe, expect, it } from "vitest";
import { STEPS, progress, rewardKey, stepsDone } from "@/lib/onboarding";

const none = { verified: false, hasAvatar: false, bio: null, likes: null, roomMessages: 0, posts: 0, pushDevices: 0 };

describe("primeiros passos", () => {
  it("nada feito: 0%", () => {
    expect(progress(stepsDone(none))).toEqual({ done: 0, total: STEPS.length, pct: 0, complete: false });
  });
  it("bio curta e poucos gostos não contam", () => {
    const d = stepsDone({ ...none, bio: "oi", likes: ["a", "b"] });
    expect(d.bio).toBe(false);
    expect(d.likes).toBe(false);
  });
  it("tudo feito: 100% e completo", () => {
    const d = stepsDone({ verified: true, hasAvatar: true, bio: "Casal liberal de SP, curtimos conversar", likes: ["a", "b", "c"], roomMessages: 1, posts: 2, pushDevices: 1 });
    expect(progress(d)).toMatchObject({ pct: 100, complete: true });
  });
  it("chave de bônus única por pessoa", () => {
    expect(rewardKey("u1")).toBe("onboarding:u1");
  });
});
