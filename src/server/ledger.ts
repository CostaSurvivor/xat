import { Prisma, type LedgerTxType, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;
export type Move = { walletId: string; amount: number };

export class InsufficientFunds extends Error {
  constructor() {
    super("Saldo insuficiente");
  }
}

export async function userWallet(tx: Tx | PrismaClient, userId: string) {
  return (
    (await tx.wallet.findUnique({ where: { userId } })) ??
    (await tx.wallet.upsert({ where: { userId }, create: { userId, kind: "USER" }, update: {} }))
  );
}

export async function systemWallet(tx: Tx | PrismaClient, kind: "SYSTEM_MINT" | "SYSTEM_SINK") {
  const w = await tx.wallet.findFirst({ where: { kind } });
  return w ?? tx.wallet.create({ data: { kind } });
}

/**
 * Registra uma transação de partidas dobradas. Regras:
 * - soma dos movimentos = 0
 * - idempotente por `key` (repetir = no-op, retorna a transação existente)
 * - carteiras USER nunca ficam negativas
 * - saldo é atualizado na mesma transação SQL, com lock de linha
 * Este é o ÚNICO lugar que altera Wallet.balance.
 */
export async function postTransaction(
  tx: Tx,
  input: { type: LedgerTxType; key: string; moves: Move[]; note?: string; actorId?: string },
) {
  const { moves } = input;
  if (moves.length < 2) throw new Error("ledger: mínimo 2 movimentos");
  if (moves.some((m) => !Number.isInteger(m.amount) || m.amount === 0)) throw new Error("ledger: valor inválido");
  if (moves.reduce((s, m) => s + m.amount, 0) !== 0) throw new Error("ledger: soma diferente de zero");

  const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.key } });
  if (existing) return { tx: existing, created: false };

  const created = await tx.ledgerTransaction.create({
    data: { type: input.type, idempotencyKey: input.key, note: input.note, actorId: input.actorId },
  });

  // lock em ordem determinística para evitar deadlock
  const ids = [...new Set(moves.map((m) => m.walletId))].sort();
  const rows = await tx.$queryRaw<{ id: string; kind: string; balance: number }[]>`
    SELECT id, kind, balance FROM Wallet WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  const bal = new Map(rows.map((r) => [r.id, { kind: r.kind, balance: Number(r.balance) }]));

  for (const m of moves) {
    const w = bal.get(m.walletId);
    if (!w) throw new Error("ledger: carteira inexistente");
    w.balance += m.amount;
    if (w.kind === "USER" && w.balance < 0) throw new InsufficientFunds();
    await tx.ledgerEntry.create({
      data: { transactionId: created.id, walletId: m.walletId, amount: m.amount, balanceAfter: w.balance },
    });
  }
  for (const [id, w] of bal) await tx.wallet.update({ where: { id }, data: { balance: w.balance } });
  return { tx: created, created: true };
}

/** Roda em transação e trata corrida na chave de idempotência. */
export async function runLedger<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(fn, { timeout: 15_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // outra requisição criou a mesma idempotencyKey em paralelo -> no-op
      return await db.$transaction(fn, { timeout: 15_000 });
    }
    throw e;
  }
}

export async function balanceOf(userId: string) {
  return (await db.wallet.findUnique({ where: { userId } }))?.balance ?? 0;
}

/** Crédito de compra aprovada (Pix manual). Idempotente por payment. */
export async function creditPayment(paymentId: string, reviewerId: string) {
  return runLedger(async (tx) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (p.status === "PAID") return p;
    if (p.status === "REJECTED" || p.status === "EXPIRED") throw new Error("Pagamento não está pendente");
    // trava a linha do pagamento: aprovações simultâneas esperam aqui
    await tx.$queryRaw`SELECT id FROM Payment WHERE id = ${p.id} FOR UPDATE`;
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: p.id } });
    if (fresh.status === "PAID") return fresh;

    if (p.kind === "VIP") await extendVip(tx, p.userId, p.vipDays ?? 30, "PIX", p.id);

    let ledgerTxId: string | null = null;
    if (p.coins > 0) {
      const mint = await systemWallet(tx, "SYSTEM_MINT");
      const w = await userWallet(tx, p.userId);
      const r = await postTransaction(tx, {
        type: p.kind === "VIP" ? "VIP_BONUS" : "PURCHASE_CREDIT",
        key: `payment:${p.id}`,
        moves: [
          { walletId: mint.id, amount: -p.coins },
          { walletId: w.id, amount: p.coins },
        ],
        actorId: reviewerId,
        note: `Pix ${p.code}`,
      });
      ledgerTxId = r.tx.id;
    }
    return tx.payment.update({
      where: { id: p.id },
      data: { status: "PAID", reviewedById: reviewerId, reviewedAt: new Date(), ledgerTxId },
    });
  });
}

export async function adminAdjust(userId: string, amount: number, actorId: string, note: string, key: string) {
  return runLedger(async (tx) => {
    const mint = await systemWallet(tx, "SYSTEM_MINT");
    const w = await userWallet(tx, userId);
    return postTransaction(tx, {
      type: "ADMIN_ADJUSTMENT",
      key,
      moves: [
        { walletId: mint.id, amount: -amount },
        { walletId: w.id, amount },
      ],
      actorId,
      note,
    });
  });
}

export async function giftCoins(fromId: string, toId: string, amount: number, key: string) {
  if (fromId === toId) throw new Error("Não dá para presentear a si mesmo");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Valor inválido");
  return runLedger(async (tx) => {
    const a = await userWallet(tx, fromId);
    const b = await userWallet(tx, toId);
    return postTransaction(tx, {
      type: "GIFT_COINS",
      key,
      moves: [
        { walletId: a.id, amount: -amount },
        { walletId: b.id, amount },
      ],
    });
  });
}

export type Duration = "7" | "30" | "perm";

/** Compra de item (para si ou para presentear). */
export async function buyItem(buyerId: string, itemId: string, duration: Duration, key: string, recipientId?: string) {
  return runLedger(async (tx) => {
    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    if (!item.active) throw new Error("Item indisponível");
    const price = duration === "7" ? item.price7 : duration === "30" ? item.price30 : item.pricePerm;
    if (price == null) throw new Error("Duração indisponível");
    if (item.limitedQty != null && item.soldCount >= item.limitedQty) throw new Error("Edição esgotada");
    const buyer = await userWallet(tx, buyerId);
    const sink = await systemWallet(tx, "SYSTEM_SINK");
    const r = await postTransaction(tx, {
      type: recipientId ? "GIFT_ITEM" : "ITEM_PURCHASE",
      key,
      moves: [
        { walletId: buyer.id, amount: -price },
        { walletId: sink.id, amount: price },
      ],
      note: `${item.slug}:${duration}`,
    });
    if (!r.created) return null;
    await tx.item.update({ where: { id: item.id }, data: { soldCount: { increment: 1 } } });
    const ownerId = recipientId ?? buyerId;
    const days = duration === "perm" ? null : Number(duration);
    // se já tem o item com validade, estende
    const current = await tx.inventoryItem.findFirst({ where: { userId: ownerId, itemId: item.id } });
    if (current) {
      if (current.expiresAt === null) return current;
      const base = current.expiresAt > new Date() ? current.expiresAt : new Date();
      return tx.inventoryItem.update({
        where: { id: current.id },
        data: { expiresAt: days === null ? null : new Date(base.getTime() + days * 86400_000) },
      });
    }
    return tx.inventoryItem.create({
      data: {
        userId: ownerId,
        itemId: item.id,
        expiresAt: days === null ? null : new Date(Date.now() + days * 86400_000),
        giftFrom: recipientId ? buyerId : null,
      },
    });
  });
}

/** Estende a assinatura a partir do fim atual (ou de agora, se já venceu). */
export async function extendVip(tx: Tx, userId: string, days: number, source: "PIX" | "ADMIN" | "TRADE", paymentId?: string) {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const start = u.vipUntil && u.vipUntil > new Date() ? u.vipUntil : new Date();
  const end = new Date(start.getTime() + days * 86400_000);
  await tx.subscription.create({ data: { userId, paymentId, startsAt: start, endsAt: end, source } });
  await tx.user.update({ where: { id: userId }, data: { vipUntil: end } });
  return end;
}

export async function grantVip(userId: string, days: number) {
  return db.$transaction((tx) => extendVip(tx, userId, days, "ADMIN"));
}
