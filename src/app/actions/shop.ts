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
    const { isBlockedBetween } = await import("@/server/access");
    if (await isBlockedBetween(user.id, to.id)) return { ok: false, error: "Destinatário indisponível" };
    recipientId = to.id;
  }
  let bought;
  try {
    // a chave inclui item/duração/destinatário: repetir a chave com outros dados não vira "presente fantasma"
    bought = await buyItem(user.id, itemId, duration, `buy:${user.id}:${itemId}:${duration}:${recipientId ?? "-"}:${idem || opKey()}`, recipientId);
  } catch (e) {
    return fail(e);
  }
  if (bought === null) return { ok: true }; // repetição da mesma compra: nada novo aconteceu
  if (recipientId) {
    const item = await db.item.findUnique({ where: { id: itemId } });
    await notify(recipientId, "GIFT", `🎁 @${user.nick} te deu de presente: ${item?.name}`, user.id);
  }
  revalidatePath("/loja");
  return { ok: true };
}

export async function sendCoins(toId: string, amount: number, idem?: string, roomSlug?: string): Promise<R> {
  const user = await requireUser();
  if (!isVerified(user)) return { ok: false, error: "Verifique seu perfil para presentear." };
  if (!limiter("gift", 10, 10 / 600).take(user.id)) return { ok: false, error: "Muitos presentes seguidos." };
  const to = await db.user.findUnique({ where: { id: toId } });
  if (!to || to.status !== "ACTIVE") return { ok: false, error: "Usuário indisponível" };
  const { isBlockedBetween } = await import("@/server/access");
  if (await isBlockedBetween(user.id, toId)) return { ok: false, error: "Usuário indisponível" };
  const amt = Math.floor(Number(amount));
  let created = false;
  try {
    // chave com destinatário e valor: reusar a chave só repete o MESMO presente (no-op)
    created = (await giftCoins(user.id, toId, amt, `gift:${user.id}:${toId}:${amt}:${idem || opKey()}`)).created;
  } catch (e) {
    return fail(e);
  }
  if (!created) return { ok: true }; // repetição: não avisa nem anima de novo
  await notify(toId, "GIFT", `🎁 @${user.nick} te deu ${amt} ${CURRENCY_NAME}!`, user.id);
  if (roomSlug) {
    // animação na sala só se quem deu pode falar nela (entrou, não banido, não silenciado)
    const { actorFor, activeSanction, canEnter, roomBySlug } = await import("@/server/rooms");
    const room = await roomBySlug(roomSlug);
    if (room && !(await canEnter(user, room, await actorFor(user, room.id))) && !(await activeSanction(room.id, user.id, "MUTE")))
      await db.message.create({ data: { roomId: room.id, authorId: user.id, kind: "GIFT", body: `${amt}|${to.nick}` } });
  }
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
