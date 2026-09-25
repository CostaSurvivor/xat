import "server-only";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { WELCOME, coinsValueCents, slotsLeft } from "@/lib/welcome";
import { brl } from "@/lib/report";
import { clientInfo } from "@/server/auth";
import { grantReward, grantVip } from "@/server/ledger";
import { notify } from "@/server/notify";

export async function welcomeOffer() {
  const [used, packages] = await Promise.all([db.welcomeBonus.count(), db.coinPackage.findMany({ where: { active: true } })]);
  const cents = coinsValueCents(WELCOME.coins, packages);
  return { left: slotsLeft(used), coins: WELCOME.coins, vipDays: WELCOME.vipDays, value: cents != null ? brl(cents) : null };
}

/**
 * Chamado logo depois de um cadastro novo (e-mail ou Google). Nunca derruba o cadastro.
 * Um bônus por aparelho/IP: criar várias contas não leva todas as vagas.
 */
export async function claimWelcome(userId: string) {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u || u.role !== "USER") return false;
    if ((await db.welcomeBonus.count()) >= WELCOME.slots) return false;
    const { ip, deviceId } = await clientInfo();
    const dup = await db.welcomeBonus.findFirst({ where: { OR: [{ ip }, ...(deviceId ? [{ deviceId }] : [])] } });
    if (dup) return false;
    let slot = 0;
    for (let s = 1; s <= WELCOME.slots && !slot; s++) {
      try {
        await db.welcomeBonus.create({ data: { slot: s, userId, ip, deviceId } });
        slot = s;
      } catch {
        // vaga já ocupada (ou pessoa já premiada): tenta a próxima
        if (await db.welcomeBonus.findUnique({ where: { userId } })) return false;
      }
    }
    if (!slot) return false;
    await grantReward(userId, WELCOME.coins, `welcome:${userId}`, `🎁 Promoção de lançamento (${slot}º cadastro)`);
    await grantVip(userId, WELCOME.vipDays);
    const offer = await welcomeOffer();
    await notify(
      userId,
      "SYSTEM",
      `🎁 Você é um dos ${WELCOME.slots} primeiros! Ganhou ${WELCOME.coins} ${CURRENCY_ICON} ${CURRENCY_NAME}${offer.value ? ` (≈ ${offer.value})` : ""} e ${WELCOME.vipDays} dias de VIP.`,
    );
    return true;
  } catch (e) {
    console.error("claimWelcome", e);
    return false;
  }
}
