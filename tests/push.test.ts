import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, PUSH_GROUPS, groupOf, pushText, pushUrl, readPrefs, wantsPush } from "@/lib/push";

describe("push", () => {
  it("cada tipo cai em um grupo só", () => {
    const all = Object.values(PUSH_GROUPS).flatMap((g) => g.kinds as readonly string[]);
    expect(new Set(all).size).toBe(all.length);
    expect(groupOf("PM")).toBe("pm");
    expect(groupOf("NADA")).toBeNull();
  });
  it("padrões: reações desligadas, o resto ligado; preferência do usuário vence", () => {
    expect(wantsPush(DEFAULT_PREFS, "PM")).toBe(true);
    expect(wantsPush(DEFAULT_PREFS, "POST_REACTION")).toBe(false);
    expect(wantsPush({ discreet: true, groups: { pm: false, reactions: true } }, "PM")).toBe(false);
    expect(wantsPush({ discreet: true, groups: { reactions: true } }, "POST_REACTION")).toBe(true);
    expect(wantsPush(DEFAULT_PREFS, "DESCONHECIDO")).toBe(false);
  });
  it("modo discreto (padrão) nunca mostra nick nem conteúdo", () => {
    const t = pushText("PM", "@Fulano: oi, vamos nos ver hoje?", true);
    expect(t.body).not.toMatch(/Fulano|oi/);
    expect(t.title).not.toMatch(/Fulano/);
    expect(pushText("PM", "@Fulano: oi", false).body).toContain("Fulano");
    expect(readPrefs(null).discreet).toBe(true);
    expect(readPrefs({ discreet: false }).discreet).toBe(false);
  });
  it("links só internos", () => {
    expect(pushUrl("PM", null, "Casal SP")).toBe("/mensagens/Casal%20SP");
    expect(pushUrl("TRADE", "abc")).toBe("/trocas/abc");
    expect(pushUrl("TESTIMONIAL")).toBe("/depoimentos");
    expect(pushUrl("POST_COMMENT")).toBe("/notificacoes");
    expect(pushUrl("TESTIMONIAL", "//evil.com")).toBe("/u/%2F%2Fevil.com");
  });
});
