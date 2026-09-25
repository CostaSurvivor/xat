import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CURRENCY_ICON } from "@/lib/config";
import { REFERRAL, cleanRefNick, inviterReward, rewardDecision } from "@/lib/referral";
import { grantReward, grantVip } from "@/server/ledger";
import { audit, notify } from "@/server/notify";

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

/** Mesma pessoa? Convidado e quem convidou já usaram o mesmo IP ou aparelho. */
async function sharesDevice(a: string, b: string) {
  const logs = await db.accessLog.findMany({ where: { userId: { in: [a, b] } }, orderBy: { createdAt: "desc" }, take: 400, select: { userId: true, ip: true, deviceId: true } });
  const of = (id: string, k: "ip" | "deviceId") => new Set(logs.filter((l) => l.userId === id).map((l) => l[k]).filter((v): v is string => !!v && v !== "0.0.0.0"));
  const [ipA, ipB, dA, dB] = [of(a, "ip"), of(b, "ip"), of(a, "deviceId"), of(b, "deviceId")];
  return [...ipA].some((x) => ipB.has(x)) || [...dA].some((x) => dB.has(x));
}

/** Na aprovação da verificação: paga os dois (uma vez só, mesmo com cliques repetidos ou aprovações simultâneas). */
export async function rewardReferral(inviteeId: string) {
  try {
    const invitee = await db.user.findUnique({ where: { id: inviteeId }, select: { id: true, nick: true, referredById: true, referralRewardedAt: true, ageVerification: true } });
    if (!invitee?.referredById) return;
    const inviter = await db.user.findUnique({ where: { id: invitee.referredById }, select: { id: true, nick: true, status: true, referralRewardCount: true } });
    const d = rewardDecision(invitee, inviter, inviter?.referralRewardCount ?? 0);
    if (d === "none") return;
    // trava do convidado: só quem marcar primeiro paga
    const lock = await db.user.updateMany({ where: { id: invitee.id, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
    if (!lock.count) return;
    await grantReward(invitee.id, REFERRAL.inviteeCoins, `ref:invitee:${invitee.id}`, `🎁 Convite de @${inviter!.nick}`);
    await notify(invitee.id, "COINS_CREDITED", `🎁 Você entrou pelo convite de @${inviter!.nick} e ganhou ${REFERRAL.inviteeCoins} ${CURRENCY_ICON}!`, inviter!.id);
    if (d !== "reward") return;
    // contas da mesma pessoa (mesmo IP/aparelho) não rendem prêmio para quem convidou
    if (await sharesDevice(inviter!.id, invitee.id)) {
      await audit(null, "referral.same-device", "User", invitee.id, { inviterId: inviter!.id });
      return;
    }
    // escada: contador atômico (duas aprovações ao mesmo tempo não recebem o mesmo nº nem passam de 20)
    const inc = await db.user.updateMany({ where: { id: inviter!.id, referralRewardCount: { lt: REFERRAL.maxRewarded } }, data: { referralRewardCount: { increment: 1 } } });
    if (!inc.count) return;
    const n = (await db.user.findUnique({ where: { id: inviter!.id }, select: { referralRewardCount: true } }))!.referralRewardCount;
    const r = inviterReward(n);
    await grantReward(inviter!.id, r.coins, `ref:inviter:${invitee.id}`, `📣 Convite nº ${n}: @${invitee.nick} foi verificado`);
    if (r.vipDays) await grantVip(inviter!.id, r.vipDays);
    await notify(
      inviter!.id,
      "COINS_CREDITED",
      `📣 @${invitee.nick} entrou pelo seu convite e foi verificado (${n}º): +${r.coins} ${CURRENCY_ICON}${r.vipDays ? ` e ${r.vipDays} dias de VIP` : ""}!`,
      invitee.id,
    );
  } catch (e) {
    console.error("rewardReferral", e);
  }
}

export async function referralStats(userId: string) {
  const [invited, verified, rewarded] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, ageVerification: "APPROVED" } }),
    // convites que renderam prêmio para esta pessoa (a escada)
    db.user.findUnique({ where: { id: userId }, select: { referralRewardCount: true } }).then((u) => u?.referralRewardCount ?? 0),
  ]);
  return { invited, verified, rewarded };
}
