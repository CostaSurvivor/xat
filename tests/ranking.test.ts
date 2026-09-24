import { describe, expect, it } from "vitest";
import { groupOf, periodOf, postScore, rankItems } from "@/lib/ranking";

describe("destaques", () => {
  it("comentário de pessoa diferente vale mais que reação", () => {
    expect(postScore(3, 0)).toBe(3);
    expect(postScore(3, 2)).toBe(7);
  });
  it("ordena por pontos e desempata pelo mais recente", () => {
    const r = rankItems([
      { id: "a", score: 5, createdAt: "2026-01-01" },
      { id: "b", score: 9, createdAt: "2026-01-01" },
      { id: "c", score: 5, createdAt: "2026-01-03" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("parâmetros inválidos caem no padrão", () => {
    expect(periodOf("x")).toBe("semana");
    expect(periodOf("mes")).toBe("mes");
    expect(groupOf("hackers")).toBe("casais");
    expect(groupOf("mulheres")).toBe("mulheres");
  });
});

import { afterAll, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** Integração com o banco: confere a consulta SQL do ranking (MySQL). */
(process.env.DATABASE_URL ? describe : describe.skip)("destaques: pontuação no banco", async () => {
  const db = new PrismaClient();
  const R = await import("@/server/ranking");
  const tag = randomBytes(4).toString("hex");
  const ids: string[] = [];
  let author = "", post = "", privatePost = "";
  const mk = async (n: string, verified: boolean, type = "SINGLE_MAN") => {
    const u = await db.user.create({ data: { email: `${n}-${tag}@t.local`, passwordHash: "x", nick: `${n}${tag}`, birthDate: new Date("1990-01-01"), profileType: type as never, ageVerification: verified ? "APPROVED" : "NONE" } });
    ids.push(u.id);
    return u.id;
  };
  const media = (owner: string) => db.media.create({ data: { ownerId: owner, kind: "POST", originalKey: "x", displayKey: "x", blurKey: "x", width: 10, height: 10, sha256: randomBytes(16).toString("hex") } });

  beforeAll(async () => {
    author = await mk("rk_a", true, "SINGLE_WOMAN");
    const v1 = await mk("rk_v1", true), v2 = await mk("rk_v2", true), un = await mk("rk_un", false);
    post = (await db.post.create({ data: { authorId: author, body: "foto", media: { create: { mediaId: (await media(author)).id, position: 0 } } } })).id;
    privatePost = (await db.post.create({ data: { authorId: author, visibility: "FRIENDS", media: { create: { mediaId: (await media(author)).id, position: 0 } } } })).id;
    // no post público: 2 verificados (contam), 1 não verificado e a própria autora (não contam)
    for (const u of [v1, v2, un, author]) await db.postReaction.create({ data: { postId: post, userId: u, emoji: "🔥" } });
    // v1 comenta 3 vezes (conta 1 pessoa = 2 pontos); a autora comenta (não conta)
    for (let i = 0; i < 3; i++) await db.postComment.create({ data: { postId: post, authorId: v1, body: `lindo ${i}` } });
    await db.postComment.create({ data: { postId: post, authorId: author, body: "obrigada" } });
    // post só para amigos: nunca entra no ranking
    for (const u of [v1, v2]) await db.postReaction.create({ data: { postId: privatePost, userId: u, emoji: "🔥" } });
  });
  afterAll(async () => {
    await db.post.deleteMany({ where: { authorId: { in: ids } } });
    await db.media.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("perfil não verificado não entra no ranking", async () => {
    const un = ids[3];
    const p2 = await db.post.create({ data: { authorId: un, body: "texto" } });
    await db.postReaction.create({ data: { postId: p2.id, userId: ids[1], emoji: "🔥" } });
    const top = await R.topProfiles(null, 30, "homens", 100);
    expect(top.some((u) => u.id === un)).toBe(false);
  });
  it("conta só verificados, sem o autor, comentarista 1x, e ignora posts não públicos", async () => {
    const top = await R.topProfiles(null, 7, "mulheres", 100);
    const me = top.find((u) => u.id === author);
    expect(me?.score).toBe(2 + 2); // 2 reações válidas + 1 comentarista (2 pontos)
  });
});
