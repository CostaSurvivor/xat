import { describe, expect, it } from "vitest";
import { STORIES, canSeeStory, cleanCaption, isActive, postError, shouldRecordView, trayOrder } from "@/lib/stories";

const now = Date.now();
const live = { authorId: "a", audience: "ALL", expiresAt: new Date(now + 3600_000), deletedAt: null };
const user = { id: "u", role: "USER" };
const rel = { friends: false, blocked: false };

describe("stories", () => {
  it("fica no ar só até expirar ou ser apagado", () => {
    expect(isActive(live, now)).toBe(true);
    expect(isActive({ ...live, expiresAt: new Date(now - 1) }, now)).toBe(false);
    expect(isActive({ ...live, deletedAt: new Date() }, now)).toBe(false);
  });
  it("quem vê: todos, só amigos, nunca com bloqueio; autor e equipe sempre", () => {
    expect(canSeeStory(live, user, rel, now)).toBe(true);
    expect(canSeeStory(live, user, { ...rel, blocked: true }, now)).toBe(false);
    const fr = { ...live, audience: "FRIENDS" };
    expect(canSeeStory(fr, user, rel, now)).toBe(false);
    expect(canSeeStory(fr, user, { ...rel, friends: true }, now)).toBe(true);
    const old = { ...live, expiresAt: new Date(now - 1) };
    expect(canSeeStory(old, user, rel, now)).toBe(false);
    expect(canSeeStory(old, { id: "a", role: "USER" }, rel, now)).toBe(true);
    expect(canSeeStory(old, { id: "m", role: "MODERATOR" }, rel, now)).toBe(true);
  });
  it("visualização sem rastro para autor, equipe e Invisível", () => {
    expect(shouldRecordView({ viewerId: "u", authorId: "a", viewerRole: "USER", invisible: false })).toBe(true);
    expect(shouldRecordView({ viewerId: "a", authorId: "a", viewerRole: "USER", invisible: false })).toBe(false);
    expect(shouldRecordView({ viewerId: "m", authorId: "a", viewerRole: "ADMIN", invisible: false })).toBe(false);
    expect(shouldRecordView({ viewerId: "u", authorId: "a", viewerRole: "USER", invisible: true })).toBe(false);
  });
  it("postar: só verificado e no máximo 10 no ar", () => {
    expect(postError({ ageVerification: "NONE" }, 0)).toMatch(/Verifique/);
    expect(postError({ ageVerification: "APPROVED" }, STORIES.maxActive - 1)).toBeNull();
    expect(postError({ ageVerification: "APPROVED" }, STORIES.maxActive)).toMatch(/no ar/);
  });
  it("legenda: corta no limite e bloqueia links", () => {
    expect(cleanCaption("  ")).toEqual({ caption: null });
    expect(cleanCaption("x".repeat(200)).caption).toHaveLength(STORIES.captionMax);
    expect(cleanCaption("veja www.site.com")).toEqual({ error: "Links não são permitidos" });
  });
  it("bandeja: eu, depois não vistos, depois mais recentes", () => {
    const t = trayOrder([
      { authorId: "x", unseen: false, latest: 9 },
      { authorId: "y", unseen: true, latest: 1 },
      { authorId: "me", unseen: false, latest: 0 },
      { authorId: "z", unseen: true, latest: 5 },
    ], "me");
    expect(t.map((i) => i.authorId)).toEqual(["me", "z", "y", "x"]);
  });
});
