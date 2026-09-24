/** Trocas: anti-golpe (versão, trava, reset de aceites) e execução atômica. Usa o banco do .env. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d("trocas entre usuários", async () => {
  const db = new PrismaClient();
  const T = await import("@/server/trades");
  const L = await import("@/server/ledger");
  const tag = randomBytes(4).toString("hex");
  let a = "", b = "", itemId = "", invA = "", invTemp = "";

  const mk = (n: string, vipDays = 0) =>
    db.user.create({ data: { email: `${n}-${tag}@t.local`, passwordHash: "x", nick: `${n}${tag}`, birthDate: new Date("1990-01-01"), profileType: "SINGLE_MAN", vipUntil: vipDays ? new Date(Date.now() + vipDays * 86400_000) : null } });
  const unlock = (id: string) => db.trade.update({ where: { id }, data: { lockedUntil: new Date(Date.now() - 1000) } });

  beforeAll(async () => {
    a = (await mk("ta", 40)).id;
    b = (await mk("tb")).id;
    await L.adminAdjust(a, 500, a, "teste", `t-a-${tag}`);
    await L.adminAdjust(b, 100, b, "teste", `t-b-${tag}`);
    itemId = (await db.item.create({ data: { slug: `tr-${tag}`, name: "Coroa teste", category: "BADGE", config: { emoji: "👑" }, pricePerm: 10 } })).id;
    invA = (await db.inventoryItem.create({ data: { userId: a, itemId, active: true } })).id;
    invTemp = (await db.inventoryItem.create({ data: { userId: a, itemId, expiresAt: new Date(Date.now() + 86400_000) } })).id;
  });
  afterAll(async () => {
    const ws = await db.wallet.findMany({ where: { userId: { in: [a, b] } } });
    const txs = (await db.ledgerEntry.findMany({ where: { walletId: { in: ws.map((w) => w.id) } } })).map((e) => e.transactionId);
    await db.ledgerEntry.deleteMany({ where: { transactionId: { in: txs } } });
    await db.ledgerTransaction.deleteMany({ where: { id: { in: txs } } });
    await db.trade.deleteMany({ where: { OR: [{ aId: a }, { bId: a }] } });
    await db.inventoryItem.deleteMany({ where: { itemId } });
    await db.item.delete({ where: { id: itemId } });
    await db.subscription.deleteMany({ where: { userId: { in: [a, b] } } });
    await db.wallet.deleteMany({ where: { id: { in: ws.map((w) => w.id) } } });
    await db.user.deleteMany({ where: { id: { in: [a, b] } } });
    await db.$disconnect();
  });

  it("não aceita itens temporários nem de outra pessoa", async () => {
    const t = await T.createTrade(a, b);
    await expect(T.setOffer(t.id, a, { coins: 0, vipDays: 0, itemIds: [invTemp] })).rejects.toThrow(/permanentes/);
    await expect(T.setOffer(t.id, b, { coins: 0, vipDays: 0, itemIds: [invA] })).rejects.toThrow(/permanentes/);
    await T.cancelTrade(t.id, a);
  });

  it("anti-golpe: trava após mudança, versão velha é recusada e mudança zera aceites", async () => {
    const t = await T.createTrade(a, b);
    let cur = await T.setOffer(t.id, a, { coins: 100, vipDays: 0, itemIds: [] });
    await expect(T.acceptTrade(t.id, b, cur.version, "accept")).rejects.toThrow(/Aguarde/);
    await unlock(t.id);
    await T.acceptTrade(t.id, b, cur.version, "accept");
    // A muda a oferta depois do aceite de B -> aceite de B some
    cur = await T.setOffer(t.id, a, { coins: 1, vipDays: 0, itemIds: [] });
    expect(cur.bAccepted).toBe(false);
    await unlock(t.id);
    await expect(T.acceptTrade(t.id, b, cur.version - 1, "accept")).rejects.toThrow(/mudou/);
    await expect(T.acceptTrade(t.id, a, cur.version, "confirm")).rejects.toThrow(/aceitar/);
    await T.cancelTrade(t.id, a);
  });

  it("executa troca completa: pimentas, item permanente e dias de assinatura", async () => {
    const t = await T.createTrade(a, b);
    await T.setOffer(t.id, a, { coins: 200, vipDays: 10, itemIds: [invA] });
    const cur = await T.setOffer(t.id, b, { coins: 50, vipDays: 0, itemIds: [] });
    await unlock(t.id);
    await T.acceptTrade(t.id, a, cur.version, "accept");
    await T.acceptTrade(t.id, b, cur.version, "accept");
    await T.acceptTrade(t.id, a, cur.version, "confirm");
    // confirmações simultâneas de B não executam duas vezes
    await Promise.allSettled([T.acceptTrade(t.id, b, cur.version, "confirm"), T.acceptTrade(t.id, b, cur.version, "confirm")]);
    expect((await db.trade.findUnique({ where: { id: t.id } }))!.status).toBe("COMPLETED");
    expect(await L.balanceOf(a)).toBe(500 - 200 + 50);
    expect(await L.balanceOf(b)).toBe(100 + 200 - 50);
    expect((await db.inventoryItem.findUnique({ where: { id: invA } }))!.userId).toBe(b);
    const ub = await db.user.findUniqueOrThrow({ where: { id: b } });
    expect(Math.round((ub.vipUntil!.getTime() - Date.now()) / 86400_000)).toBe(10);
    const ua = await db.user.findUniqueOrThrow({ where: { id: a } });
    expect(Math.round((ua.vipUntil!.getTime() - Date.now()) / 86400_000)).toBe(30);
  });

  it("dias de assinatura nos dois sentidos: ninguém perde dias", async () => {
    // depois do teste anterior: A tem ~30 dias e B ~10
    const t = await T.createTrade(a, b);
    await T.setOffer(t.id, a, { coins: 0, vipDays: 5, itemIds: [] });
    const cur = await T.setOffer(t.id, b, { coins: 0, vipDays: 2, itemIds: [] });
    await unlock(t.id);
    for (const u of [a, b]) await T.acceptTrade(t.id, u, cur.version, "accept");
    for (const u of [a, b]) await T.acceptTrade(t.id, u, cur.version, "confirm");
    const days = async (id: string) => Math.round(((await db.user.findUniqueOrThrow({ where: { id } })).vipUntil!.getTime() - Date.now()) / 86400_000);
    expect(await days(a)).toBe(30 - 5 + 2);
    expect(await days(b)).toBe(10 + 5 - 2);
  });

  it("saldo insuficiente: nada muda (rollback)", async () => {
    const t = await T.createTrade(b, a);
    await expect(T.setOffer(t.id, b, { coins: 99999, vipDays: 0, itemIds: [] })).rejects.toThrow(/só tem/);
    const cur = await T.setOffer(t.id, b, { coins: 250, vipDays: 0, itemIds: [invA] });
    // saldo gasto entre a oferta e a confirmação: a execução recusa
    await L.giftCoins(b, a, 200, `drain-${tag}`);
    await unlock(t.id);
    for (const u of [b, a]) await T.acceptTrade(t.id, u, cur.version, "accept");
    await T.acceptTrade(t.id, b, cur.version, "confirm");
    await expect(T.acceptTrade(t.id, a, cur.version, "confirm")).rejects.toThrow(/insuficiente/);
    expect((await db.inventoryItem.findUnique({ where: { id: invA } }))!.userId).toBe(b);
    expect((await db.trade.findUnique({ where: { id: t.id } }))!.status).toBe("PENDING");
  });
});
