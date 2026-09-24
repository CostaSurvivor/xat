import { describe, expect, it } from "vitest";
import { shouldRecordVisit, visitIncrement, VISITS } from "@/lib/visits";

describe("quem visitou meu perfil", () => {
  const base = { viewerId: "a", targetId: "b", viewerRole: "USER", invisible: false, blocked: false };
  it("registra visita comum", () => expect(shouldRecordVisit(base)).toBe(true));
  it("não registra: a si mesmo, equipe do site, poder Invisível, bloqueio", () => {
    expect(shouldRecordVisit({ ...base, targetId: "a" })).toBe(false);
    expect(shouldRecordVisit({ ...base, viewerRole: "ADMIN" })).toBe(false);
    expect(shouldRecordVisit({ ...base, viewerRole: "MODERATOR" })).toBe(false);
    expect(shouldRecordVisit({ ...base, invisible: true })).toBe(false);
    expect(shouldRecordVisit({ ...base, blocked: true })).toBe(false);
  });
  it("mesma pessoa só conta de novo depois de 30 min", () => {
    const now = Date.now();
    expect(visitIncrement(null, now)).toBe(1);
    expect(visitIncrement(new Date(now - 5 * 60_000), now)).toBe(0);
    expect(visitIncrement(new Date(now - VISITS.recountAfterMs - 1000), now)).toBe(1);
  });
});
