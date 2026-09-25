import { describe, expect, it } from "vitest";
import { DAILY_REWARDS, cycleDay, nextStreak } from "@/lib/daily";

describe("presença diária", () => {
  it("primeiro dia", () => {
    expect(nextStreak(null, 0, "2026-10-01")).toEqual({ canClaim: true, days: 1, dayInCycle: 1, reward: 5 });
  });
  it("dia seguinte continua; mesmo dia não paga de novo", () => {
    expect(nextStreak("2026-10-01", 1, "2026-10-02")).toMatchObject({ canClaim: true, days: 2, reward: 5 });
    expect(nextStreak("2026-10-02", 2, "2026-10-02")).toMatchObject({ canClaim: false, reward: 0 });
  });
  it("pulou um dia: recomeça", () => {
    expect(nextStreak("2026-10-01", 5, "2026-10-03")).toMatchObject({ days: 1, reward: 5 });
  });
  it("7º dia vale 50 e depois o ciclo recomeça", () => {
    expect(nextStreak("2026-10-06", 6, "2026-10-07")).toMatchObject({ days: 7, dayInCycle: 7, reward: 50 });
    expect(nextStreak("2026-10-07", 7, "2026-10-08")).toMatchObject({ days: 8, dayInCycle: 1, reward: 5 });
    expect(cycleDay(14)).toBe(7);
  });
  it("virada de mês", () => {
    expect(nextStreak("2026-10-31", 3, "2026-11-01")).toMatchObject({ days: 4, reward: DAILY_REWARDS[3] });
  });
});
