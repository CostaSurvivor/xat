"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CURRENCY_NAME } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { isVerified, requireUser } from "@/server/auth";
import { buyItem, giftCoins, InsufficientFunds, type Duration } from "@/server/ledger";
import { notify } from "@/server/notify";

type R = { ok: boolean; error?: string };

const opKey = () => randomBytes(12).toString("hex");

function fail(e: unknown): R {
  if (e instanceof InsufficientFunds) return { ok: false, error: `${CURRENCY_NAME} insuficientes. Recarregue na carteira.` };
  return { ok: false, error: e instanceof Error ? e.message : "Erro" };
}

export async function purchaseItem(itemId: string, duration: Duration, giftToNick?: string, idem?: string): Promise<R> {
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para usar a loja." };
  if (!limiter("buy", 20, 20 / 600).take(user.id)) return { ok: false, error: "Muitas compras seguidas." };
  let recipientId: string | undefined;
  if (giftToNick) {
    const to = await db.user.findFirst({ where: { nick: giftToNick, status: "ACTIVE" } });
    if (!to || to.id === user.id) return { ok: false, error: "Destinatário inválido" };
    recipientId = to.id;
  }
  try {
    await buyItem(user.id, itemId, duration, `buy:${user.id}:${idem || opKey()}`, recipientId);
  } catch (e) {
    return fail(e);
  }
  if (recipientId) {
    const item = await db.item.findUnique({ where: { id: itemId } });
    await notify(recipientId, "GIFT", `🎁 @${user.nick} te deu de presente: ${item?.name}`, user.id);
  }
  revalidatePath("/loja");
  return { ok: true };
}

export async function sendCoins(toId: string, amount: number, idem?: string): Promise<R> {
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para presentear." };
  if (!limiter("gift", 10, 10 / 600).take(user.id)) return { ok: false, error: "Muitos presentes seguidos." };
  const to = await db.user.findUnique({ where: { id: toId } });
  if (!to || to.status !== "ACTIVE") return { ok: false, error: "Usuário indisponível" };
  try {
    await giftCoins(user.id, toId, Math.floor(amount), `gift:${user.id}:${idem || opKey()}`);
  } catch (e) {
    return fail(e);
  }
  await notify(toId, "GIFT", `🎁 @${user.nick} te deu ${amount} ${CURRENCY_NAME}!`, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const STACKABLE = new Set(["BADGE", "POWER"]);

/** Ativa/desativa item do inventário. Um ativo por categoria (exceto badges e poderes). */
export async function toggleItem(inventoryId: string) {
  const user = await requireUser();
  const inv = await db.inventoryItem.findUnique({ where: { id: inventoryId }, include: { item: true } });
  if (!inv || inv.userId !== user.id) return;
  if (inv.expiresAt && inv.expiresAt < new Date()) return;
  if (!inv.active && !STACKABLE.has(inv.item.category)) {
    await db.inventoryItem.updateMany({ where: { userId: user.id, active: true, item: { category: inv.item.category } }, data: { active: false } });
  }
  await db.inventoryItem.update({ where: { id: inv.id }, data: { active: !inv.active } });
  revalidatePath("/loja/inventario");
}
