/**
 * Testes de integração do ledger contra o banco (DATABASE_URL). Usa um prefixo
 * único e limpa ao final. Pula se não houver banco configurado.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d("ledger", async () => {
  const db = new PrismaClient();
  const L = await import("@/server/ledger");
  const tag = randomBytes(4).toString("hex");
  let a: { id: string }, b: { id: string };
  let itemId: string;

  const mkUser = (n: string) =>
    db.user.create({ data: { email: `${n}-${tag}@t.local`, passwordHash: "x", nick: `${n}${tag}`, birthDate: new Date("1990-01-01"), profileType: "SINGLE_MAN", ageVerification: "APPROVED" } });

  beforeAll(async () => {
    a = await mkUser("la");
    b = await mkUser("lb");
    itemId = (await db.item.create({ data: { slug: `t-${tag}`, name: "T", category: "BADGE", config: { emoji: "🔥" }, price30: 40, limitedQty: 2 } })).id;
  });
  afterAll(async () => {
    const ws = await db.wallet.findMany({ where: { userId: { in: [a.id, b.id] } } });
    const txIds = (await db.ledgerEntry.findMany({ where: { walletId: { in: ws.map((w) => w.id) } } })).map((e) => e.transactionId);
    await db.ledgerEntry.deleteMany({ where: { transactionId: { in: txIds } } });
    await db.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await db.inventoryItem.deleteMany({ where: { itemId } });
    await db.subscription.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
    await db.payment.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
    await db.wallet.deleteMany({ where: { id: { in: ws.map((w) => w.id) } } });
    await db.item.delete({ where: { id: itemId } });
    await db.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await db.$disconnect();
  });

  const sumOfTx = async (key: string) => {
    const tx = await db.ledgerTransaction.findUnique({ where: { idempotencyKey: key }, include: { entries: true } });
    return tx!.entries.reduce((s, e) => s + e.amount, 0);
  };

  it("crédito de pagamento é idempotente (aprovar 2x credita 1x)", async () => {
    const p = await db.payment.create({ data: { userId: a.id, code: `T${tag}`.slice(0, 12), amountCents: 990, coins: 100, packageName: "t" } });
    await L.creditPayment(p.id, a.id);
    await L.creditPayment(p.id, a.id);
    expect(await L.balanceOf(a.id)).toBe(100);
    expect(await sumOfTx(`payment:${p.id}`)).toBe(0);
    expect((await db.payment.findUnique({ where: { id: p.id } }))!.status).toBe("PAID");
  });

  it("aprovações concorrentes do mesmo pagamento creditam uma vez só", async () => {
    const p = await db.payment.create({ data: { userId: b.id, code: `U${tag}`.slice(0, 12), amountCents: 990, coins: 50, packageName: "t" } });
    await Promise.allSettled([1, 2, 3, 4].map(() => L.creditPayment(p.id, b.id)));
    expect(await L.balanceOf(b.id)).toBe(50);
  });

  it("presente move saldo e nunca deixa negativo", async () => {
    await L.giftCoins(a.id, b.id, 30, `g1-${tag}`);
    expect(await L.balanceOf(a.id)).toBe(70);
    expect(await L.balanceOf(b.id)).toBe(80);
    await expect(L.giftCoins(a.id, b.id, 1000, `g2-${tag}`)).rejects.toBeInstanceOf(L.InsufficientFunds);
    expect(await L.balanceOf(a.id)).toBe(70);
    await expect(L.giftCoins(a.id, a.id, 1, `g3-${tag}`)).rejects.toThrow();
  });

  it("repetir a mesma chave de presente não duplica", async () => {
    await L.giftCoins(a.id, b.id, 10, `g4-${tag}`);
    await L.giftCoins(a.id, b.id, 10, `g4-${tag}`);
    expect(await L.balanceOf(a.id)).toBe(60);
  });

  it("gastos concorrentes não passam do saldo", async () => {
    // a tem 60; 5 presentes de 20 em paralelo -> no máximo 3 passam
    const r = await Promise.allSettled([1, 2, 3, 4, 5].map((i) => L.giftCoins(a.id, b.id, 20, `c${i}-${tag}`)));
    const ok = r.filter((x) => x.status === "fulfilled").length;
    expect(ok).toBe(3);
    expect(await L.balanceOf(a.id)).toBe(0);
  });

  it("compra de item debita, cria inventário e respeita edição limitada", async () => {
    const before = await L.balanceOf(b.id);
    await L.buyItem(b.id, itemId, "30", `buy1-${tag}`);
    expect(await L.balanceOf(b.id)).toBe(before - 40);
    const inv = await db.inventoryItem.findFirst({ where: { userId: b.id, itemId } });
    expect(inv?.expiresAt).not.toBeNull();
    await L.buyItem(b.id, itemId, "30", `buy2-${tag}`); // estende validade
    const inv2 = await db.inventoryItem.findFirst({ where: { userId: b.id, itemId } });
    expect(inv2!.expiresAt!.getTime()).toBeGreaterThan(inv!.expiresAt!.getTime());
    await expect(L.buyItem(b.id, itemId, "30", `buy3-${tag}`)).rejects.toThrow(/esgotada/);
    await expect(L.buyItem(b.id, itemId, "7", `buy4-${tag}`)).rejects.toThrow(/Duração/);
  });

  it("edição limitada: compras simultâneas da última unidade não vendem a mais", async () => {
    const lim = await db.item.create({ data: { slug: `lim-${tag}`, name: "L", category: "BADGE", config: { emoji: "💎" }, price30: 1, limitedQty: 1 } });
    try {
      await L.adminAdjust(b.id, 50, a.id, "t", `lim-seed-${tag}`);
      const before = await L.balanceOf(b.id);
      const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => L.buyItem(b.id, lim.id, "30", `lim-${tag}-${i}`)));
      expect(rs.filter((r) => r.status === "fulfilled").length).toBe(1);
      expect((await db.item.findUniqueOrThrow({ where: { id: lim.id } })).soldCount).toBe(1);
      expect(await L.balanceOf(b.id)).toBe(before - 1); // só uma cobrança
    } finally {
      await db.inventoryItem.deleteMany({ where: { itemId: lim.id } });
      await db.item.delete({ where: { id: lim.id } });
    }
  });

  it("assinatura: aprovar 2x estende uma vez e dá o bônus uma vez", async () => {
    const before = await L.balanceOf(a.id);
    const p = await db.payment.create({ data: { userId: a.id, kind: "VIP", vipDays: 30, code: `V${tag}`.slice(0, 12), amountCents: 2990, coins: 100, packageName: "Mensal" } });
    await Promise.allSettled([L.creditPayment(p.id, a.id), L.creditPayment(p.id, a.id)]);
    await L.creditPayment(p.id, a.id);
    const u = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    const days = (u.vipUntil!.getTime() - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(await db.subscription.count({ where: { userId: a.id } })).toBe(1);
    expect(await L.balanceOf(a.id)).toBe(before + 100);
    await db.subscription.deleteMany({ where: { userId: a.id } });
  });

  it("soma de todas as carteiras do sistema + usuários é zero", async () => {
    const agg = await db.ledgerEntry.aggregate({ _sum: { amount: true } });
    expect(agg._sum.amount).toBe(0);
  });
});
