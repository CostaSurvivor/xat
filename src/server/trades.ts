import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { InsufficientFunds, postTransaction, userWallet, extendVip } from "./ledger";

export const TRADE_LOCK_MS = 5000; // atraso anti-golpe após qualquer alteração
export const TRADE_TTL_MS = 24 * 3600_000;
export const MAX_TRADE_ITEMS = 20;

export class TradeError extends Error {}

type Tx = Prisma.TransactionClient;

export function sideOf(t: { aId: string; bId: string }, userId: string): "A" | "B" | null {
  return t.aId === userId ? "A" : t.bId === userId ? "B" : null;
}

/** Itens que podem entrar numa troca: permanentes e do próprio usuário. */
export async function tradableItems(userId: string) {
  return db.inventoryItem.findMany({
    where: { userId, expiresAt: null },
    include: { item: { select: { name: true, category: true, rarity: true, config: true, powerScore: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Atualiza a oferta de um lado. Zera aceites/confirmações dos DOIS lados,
 * incrementa a versão e trava o aceite por alguns segundos (anti-golpe).
 */
export async function setOffer(tradeId: string, userId: string, offer: { coins: number; vipDays: number; itemIds: string[] }) {
  const coins = Math.floor(offer.coins);
  const vipDays = Math.floor(offer.vipDays);
  if (!Number.isFinite(coins) || coins < 0 || coins > 10_000_000) throw new TradeError("Valor de Pimentas inválido");
  if (!Number.isFinite(vipDays) || vipDays < 0 || vipDays > 3650) throw new TradeError("Dias de assinatura inválidos");
  const itemIds = [...new Set(offer.itemIds)].slice(0, MAX_TRADE_ITEMS);
  return db.$transaction(async (tx) => {
    const t = await lockTrade(tx, tradeId);
    const side = sideOf(t, userId);
    if (!side) throw new TradeError("Troca não encontrada");
    if (t.status !== "PENDING") throw new TradeError("Esta troca já foi encerrada");
    // valida já na oferta (a execução confere de novo, com trava de saldo)
    if (coins > 0) {
      const w = await tx.wallet.findUnique({ where: { userId } });
      if ((w?.balance ?? 0) < coins) throw new TradeError(`Você só tem ${w?.balance ?? 0} Pimentas`);
    }
    if (vipDays > 0) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const left = u.vipUntil ? Math.floor((u.vipUntil.getTime() - Date.now()) / 86400_000) : 0;
      if (left < vipDays) throw new TradeError(`Você só tem ${left} dias de assinatura`);
    }
    if (itemIds.length) {
      const owned = await tx.inventoryItem.count({ where: { id: { in: itemIds }, userId, expiresAt: null } });
      if (owned !== itemIds.length) throw new TradeError("Só itens permanentes seus podem entrar na troca");
    }
    await tx.tradeItem.deleteMany({ where: { tradeId, side } });
    if (itemIds.length) await tx.tradeItem.createMany({ data: itemIds.map((inventoryItemId) => ({ tradeId, inventoryItemId, side })) });
    return tx.trade.update({
      where: { id: tradeId },
      data: {
        ...(side === "A" ? { aCoins: coins, aVipDays: vipDays } : { bCoins: coins, bVipDays: vipDays }),
        version: { increment: 1 },
        aAccepted: false,
        bAccepted: false,
        aConfirmed: false,
        bConfirmed: false,
        lockedUntil: new Date(Date.now() + TRADE_LOCK_MS),
      },
    });
  });
}

async function lockTrade(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM Trade WHERE id = ${id} FOR UPDATE`;
  const t = await tx.trade.findUnique({ where: { id } });
  if (!t) throw new TradeError("Troca não encontrada");
  if (t.status === "PENDING" && Date.now() - t.createdAt.getTime() > TRADE_TTL_MS) {
    await tx.trade.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new TradeError("Esta troca expirou");
  }
  return t;
}

/**
 * Etapa 1: aceitar a versão atual. Etapa 2: confirmar (senha conferida antes, na action).
 * Quando os dois confirmam a MESMA versão, a troca é executada na mesma transação.
 */
export async function acceptTrade(tradeId: string, userId: string, version: number, step: "accept" | "confirm") {
  return db.$transaction(
    async (tx) => {
      const t = await lockTrade(tx, tradeId);
      const side = sideOf(t, userId);
      if (!side) throw new TradeError("Troca não encontrada");
      if (t.status !== "PENDING") throw new TradeError("Esta troca já foi encerrada");
      if (t.version !== version) throw new TradeError("A oferta mudou. Confira de novo antes de aceitar.");
      if (t.lockedUntil && t.lockedUntil > new Date()) throw new TradeError("Aguarde alguns segundos: a oferta acabou de mudar.");
      const empty = !t.aCoins && !t.bCoins && !t.aVipDays && !t.bVipDays && (await tx.tradeItem.count({ where: { tradeId } })) === 0;
      if (empty) throw new TradeError("A troca está vazia");
      if (step === "accept") {
        return tx.trade.update({ where: { id: tradeId }, data: side === "A" ? { aAccepted: true } : { bAccepted: true } });
      }
      if (!t.aAccepted || !t.bAccepted) throw new TradeError("Os dois precisam aceitar antes de confirmar");
      const updated = await tx.trade.update({ where: { id: tradeId }, data: side === "A" ? { aConfirmed: true } : { bConfirmed: true } });
      if (updated.aConfirmed && updated.bConfirmed) return executeTrade(tx, updated.id);
      return updated;
    },
    { timeout: 20_000 },
  );
}

async function executeTrade(tx: Tx, tradeId: string) {
  const t = await tx.trade.findUniqueOrThrow({ where: { id: tradeId }, include: { items: true } });
  const [ua, ub] = await Promise.all([tx.user.findUniqueOrThrow({ where: { id: t.aId } }), tx.user.findUniqueOrThrow({ where: { id: t.bId } })]);
  if (ua.status !== "ACTIVE" || ub.status !== "ACTIVE") throw new TradeError("Um dos participantes não está ativo");

  // 1) Pimentas: um único lançamento no ledger (soma zero, saldo nunca negativo)
  const netA = t.bCoins - t.aCoins;
  if (netA !== 0) {
    const [wa, wb] = await Promise.all([userWallet(tx, t.aId), userWallet(tx, t.bId)]);
    try {
      await postTransaction(tx, {
        type: "TRADE",
        key: `trade:${t.id}`,
        moves: [
          { walletId: wa.id, amount: netA },
          { walletId: wb.id, amount: -netA },
        ],
        note: `troca ${t.id}`,
      });
    } catch (e) {
      if (e instanceof InsufficientFunds) throw new TradeError("Saldo de Pimentas insuficiente para concluir a troca");
      throw e;
    }
  }

  // 2) Itens: precisam continuar sendo de quem ofereceu e permanentes
  for (const it of t.items) {
    const from = it.side === "A" ? t.aId : t.bId;
    const to = it.side === "A" ? t.bId : t.aId;
    const inv = await tx.inventoryItem.findUnique({ where: { id: it.inventoryItemId } });
    if (!inv || inv.userId !== from || inv.expiresAt !== null) throw new TradeError("Um dos itens não está mais disponível");
    await tx.inventoryItem.update({ where: { id: inv.id }, data: { userId: to, active: false, giftFrom: null } });
  }

  // 3) Dias de assinatura: quem dá precisa ter os dias restantes
  const giveVip = async (fromUser: typeof ua, toId: string, days: number) => {
    if (!days) return;
    const left = fromUser.vipUntil ? (fromUser.vipUntil.getTime() - Date.now()) / 86400_000 : 0;
    if (left < days) throw new TradeError(`@${fromUser.nick} não tem ${days} dias de assinatura para trocar`);
    await tx.user.update({ where: { id: fromUser.id }, data: { vipUntil: new Date(fromUser.vipUntil!.getTime() - days * 86400_000) } });
    await extendVip(tx, toId, days, "TRADE");
  };
  await giveVip(ua, t.bId, t.aVipDays);
  await giveVip(ub, t.aId, t.bVipDays);

  return tx.trade.update({ where: { id: t.id }, data: { status: "COMPLETED", completedAt: new Date() } });
}

export async function createTrade(aId: string, bId: string) {
  if (aId === bId) throw new TradeError("Não dá para trocar consigo mesmo");
  const { isBlockedBetween } = await import("./access");
  if (await isBlockedBetween(aId, bId)) throw new TradeError("Usuário indisponível");
  const open = await db.trade.findFirst({
    where: { status: "PENDING", createdAt: { gt: new Date(Date.now() - TRADE_TTL_MS) }, OR: [{ aId, bId }, { aId: bId, bId: aId }] },
  });
  if (open) return open;
  if ((await db.trade.count({ where: { aId, status: "PENDING", createdAt: { gt: new Date(Date.now() - TRADE_TTL_MS) } } })) >= 5)
    throw new TradeError("Você já tem 5 trocas abertas. Conclua ou cancele alguma.");
  return db.trade.create({ data: { aId, bId } });
}

export async function cancelTrade(tradeId: string, userId: string) {
  const t = await db.trade.findUnique({ where: { id: tradeId } });
  if (!t || !sideOf(t, userId) || t.status !== "PENDING") return null;
  return db.trade.update({ where: { id: tradeId }, data: { status: "CANCELLED" } });
}

/** Visão da troca para a tela (itens com nome/categoria, oferta de cada lado). */
export async function tradeView(tradeId: string, viewerId: string) {
  const t = await db.trade.findUnique({ where: { id: tradeId }, include: { items: true } });
  if (!t || !sideOf(t, viewerId)) return null;
  const inv = await db.inventoryItem.findMany({
    where: { id: { in: t.items.map((i) => i.inventoryItemId) } },
    include: { item: { select: { name: true, category: true, rarity: true, config: true, powerScore: true } } },
  });
  const users = await db.user.findMany({ where: { id: { in: [t.aId, t.bId] } }, select: { id: true, nick: true, avatarId: true } });
  const itemsOf = (side: "A" | "B") =>
    t.items.filter((i) => i.side === side).map((i) => inv.find((x) => x.id === i.inventoryItemId)).filter(Boolean).map((x) => ({ id: x!.id, name: x!.item.name, category: x!.item.category, rarity: x!.item.rarity, config: x!.item.config }));
  const expired = t.status === "PENDING" && Date.now() - t.createdAt.getTime() > TRADE_TTL_MS;
  return {
    id: t.id,
    me: sideOf(t, viewerId)!,
    status: expired ? "EXPIRED" : t.status,
    version: t.version,
    lockedMs: t.lockedUntil ? Math.max(0, t.lockedUntil.getTime() - Date.now()) : 0,
    A: { user: users.find((u) => u.id === t.aId)!, coins: t.aCoins, vipDays: t.aVipDays, items: itemsOf("A"), accepted: t.aAccepted, confirmed: t.aConfirmed },
    B: { user: users.find((u) => u.id === t.bId)!, coins: t.bCoins, vipDays: t.bVipDays, items: itemsOf("B"), accepted: t.bAccepted, confirmed: t.bConfirmed },
  };
}
export type TradeViewT = NonNullable<Awaited<ReturnType<typeof tradeView>>>;
