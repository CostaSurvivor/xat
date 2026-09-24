import { describe, expect, it } from "vitest";
import { RateLimiter, isFlood } from "@/lib/ratelimit";

describe("rate limit (token bucket)", () => {
  it("bloqueia após esgotar e recarrega com o tempo", () => {
    let t = 0;
    const rl = new RateLimiter(3, 1, () => t);
    expect([rl.take("u"), rl.take("u"), rl.take("u"), rl.take("u")]).toEqual([true, true, true, false]);
    t = 1000;
    expect(rl.take("u")).toBe(true);
    expect(rl.take("u")).toBe(false);
  });
  it("chaves são independentes (usuário vs IP)", () => {
    const rl = new RateLimiter(1, 0.001, () => 0);
    expect(rl.take("a")).toBe(true);
    expect(rl.take("a")).toBe(false);
    expect(rl.take("b")).toBe(true);
  });
  it("não passa da capacidade mesmo após muito tempo", () => {
    let t = 0;
    const rl = new RateLimiter(2, 10, () => t);
    t = 1_000_000;
    expect([rl.take("x"), rl.take("x"), rl.take("x")]).toEqual([true, true, false]);
  });
});

describe("flood", () => {
  const now = 1_000_000;
  const msg = (body: string, agoMs: number) => ({ body, createdAt: new Date(now - agoMs) });
  it("6+ mensagens em 10s é flood", () => {
    expect(isFlood([1, 2, 3, 4, 5, 6].map((i) => msg(`m${i}`, i * 1000)), "x", now)).toBe(true);
    expect(isFlood([1, 2, 3].map((i) => msg(`m${i}`, i * 1000)), "x", now)).toBe(false);
  });
  it("mesma mensagem repetida 3x em 1 min é flood (ignora maiúsculas/espaços)", () => {
    expect(isFlood([msg("OI", 20_000), msg("oi ", 40_000), msg("oi", 50_000)], "oi", now)).toBe(true);
    expect(isFlood([msg("oi", 20_000), msg("oi", 90_000)], "oi", now)).toBe(false);
  });
});
