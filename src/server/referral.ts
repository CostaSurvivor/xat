import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CURRENCY_ICON } from "@/lib/config";
import { REFERRAL, cleanRefNick, rewardDecision } from "@/lib/referral";
import { grantReward } from "@/server/ledger";
import { notify } from "@/server/notify";

/** No cadastro: liga a conta nova a quem mandou o convite (cookie do link /convite/<nick>). Nunca derruba o cadastro. */
export async function attachReferrer(userId: string) {
  try {
    const jar = await cookies();
    const nick = cleanRefNick(jar.get(REFERRAL.cookie)?.value);
    if (!nick) return;
    jar.delete(REFERRAL.cookie);
    const inviter = await db.user.findFirst({ where: { nick, status: "ACTIVE" }, select: { id: true } });
    if (!inviter || inviter.id === userId) return;
    await db.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: inviter.id } });
  } catch (e) {
    console.error("attachReferrer", e);
  }
}

/** Na aprovação da verificação: paga os dois (uma vez só, mesmo com cliques repetidos). */
export async function rewardReferral(inviteeId: string) {
  try {
    const invitee = await db.user.findUnique({ where: { id: inviteeId }, select: { id: true, nick: true, referredById: true, referralRewardedAt: true, ageVerification: true } });
    if (!invitee?.referredById) return;
    const inviter = await db.user.findUnique({ where: { id: invitee.referredById }, select: { id: true, nick: true, status: true } });
    const rewarded = inviter ? await db.user.count({ where: { referredById: inviter.id, referralRewardedAt: { not: null } } }) : 0;
    const d = rewardDecision(invitee, inviter, rewarded);
    if (d === "none") return;
    // trava: só quem marcar primeiro paga
    const lock = await db.user.updateMany({ where: { id: invitee.id, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
    if (!lock.count) return;
    await grantReward(invitee.id, REFERRAL.inviteeCoins, `ref:invitee:${invitee.id}`, `🎁 Convite de @${inviter!.nick}`);
    await notify(invitee.id, "COINS_CREDITED", `🎁 Você entrou pelo convite de @${inviter!.nick} e ganhou ${REFERRAL.inviteeCoins} ${CURRENCY_ICON}!`, inviter!.id);
    if (d === "reward") {
      await grantReward(inviter!.id, REFERRAL.inviterCoins, `ref:inviter:${invitee.id}`, `📣 Convite: @${invitee.nick} foi verificado`);
      await notify(inviter!.id, "COINS_CREDITED", `📣 @${invitee.nick} entrou pelo seu convite e foi verificado: +${REFERRAL.inviterCoins} ${CURRENCY_ICON}!`, invitee.id);
    }
  } catch (e) {
    console.error("rewardReferral", e);
  }
}

export async function referralStats(userId: string) {
  const [invited, verified, rewarded] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, ageVerification: "APPROVED" } }),
    db.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
  ]);
  return { invited, verified, rewarded };
}
