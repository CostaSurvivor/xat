import "server-only";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { WELCOME, coinsValueCents, slotsLeft } from "@/lib/welcome";
import { brl } from "@/lib/report";
import { grantReward, grantVip } from "@/server/ledger";
import { notify } from "@/server/notify";

export async function welcomeOffer() {
  const [used, packages] = await Promise.all([db.welcomeBonus.count(), db.coinPackage.findMany({ where: { active: true } })]);
  const cents = coinsValueCents(WELCOME.coins, packages);
  return { left: slotsLeft(used), coins: WELCOME.coins, vipDays: WELCOME.vipDays, value: cents != null ? brl(cents) : null };
}

/**
 * Chamado quando a selfie é APROVADA (não no cadastro: contas falsas em massa não levam as vagas).
 * Um bônus por aparelho/IP, olhando os acessos registrados da própria pessoa. Nunca derruba a aprovação.
 */
export async function claimWelcome(userId: string) {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, ageVerification: true } });
    if (!u || u.role !== "USER" || u.ageVerification !== "APPROVED") return false;
    if (await db.welcomeBonus.findUnique({ where: { userId } })) return false;
    if ((await db.welcomeBonus.count()) >= WELCOME.slots) return false;
    const logs = await db.accessLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 50, select: { ip: true, deviceId: true } });
    const ips = [...new Set(logs.map((l) => l.ip).filter((ip) => ip && ip !== "0.0.0.0"))];
    const devices = [...new Set(logs.map((l) => l.deviceId).filter((d): d is string => !!d))];
    if (ips.length || devices.length) {
      const dup = await db.welcomeBonus.findFirst({ where: { OR: [...(ips.length ? [{ ip: { in: ips } }] : []), ...(devices.length ? [{ deviceId: { in: devices } }] : [])] } });
      if (dup) return false;
    }
    let slot = 0;
    for (let s = 1; s <= WELCOME.slots && !slot; s++) {
      try {
        await db.welcomeBonus.create({ data: { slot: s, userId, ip: ips[0] ?? "0.0.0.0", deviceId: devices[0] ?? null } });
        slot = s;
      } catch {
        // vaga já ocupada (ou pessoa já premiada): tenta a próxima
        if (await db.welcomeBonus.findUnique({ where: { userId } })) return false;
      }
    }
    if (!slot) return false;
    await grantReward(userId, WELCOME.coins, `welcome:${userId}`, `🎁 Promoção de lançamento (${slot}º perfil verificado)`);
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
