import { describe, expect, it } from "vitest";
import { hasTag, normalizeTag, reactionSummary, segments } from "@/lib/richtext";

describe("segments", () => {
  it("separa texto, #tags e @menções", () => {
    expect(segments("Noite boa #hotwife com @LoboSul.")).toEqual([
      { t: "text", v: "Noite boa " },
      { t: "tag", v: "hotwife" },
      { t: "text", v: " com " },
      { t: "mention", v: "LoboSul" },
      { t: "text", v: "." },
    ]);
  });
  it("acentos e começo do texto", () => {
    expect(segments("#ménage hoje")).toEqual([{ t: "tag", v: "ménage" }, { t: "text", v: " hoje" }]);
  });
  it("não pega e-mail nem C# nem # sozinho", () => {
    expect(segments("mail a@b.com e C# e # solto").every((s) => s.t === "text")).toBe(true);
  });
});

describe("hasTag / normalizeTag", () => {
  it("palavra inteira, sem diferenciar maiúsculas", () => {
    expect(hasTag("Curtimos #Swing", "swing")).toBe(true);
    expect(hasTag("#swinger demais", "swing")).toBe(false);
    expect(hasTag(null, "swing")).toBe(false);
  });
  it("normaliza", () => {
    expect(normalizeTag("#HotWife")).toBe("hotwife");
    expect(normalizeTag("a")).toBeNull();
    expect(normalizeTag("x<script>")).toBeNull();
  });
});

describe("reactionSummary", () => {
  it("3 mais usadas + total", () => {
    expect(reactionSummary({ "🔥": 5, "❤️": 2, "😈": 7, "😂": 1, "👏": 0 })).toEqual({ top: ["😈", "🔥", "❤️"], total: 15 });
    expect(reactionSummary({})).toEqual({ top: [], total: 0 });
  });
});
