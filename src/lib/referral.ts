/** Convide amigos: regras puras (testadas em tests/referral.test.ts). */

export const REFERRAL = {
  /** Pimentas para quem foi convidado, quando é verificado */
  inviteeCoins: 100,
  /** convites premiados por pessoa */
  maxRewarded: 20,
  cookie: "ref",
  cookieDays: 30,
};

/** Escada de prêmios de quem convida: quanto mais convites verificados, mais vale cada um. */
export const INVITER_TIERS = [
  { upTo: 5, coins: 100 },
  { upTo: 10, coins: 150 },
  { upTo: 15, coins: 200 },
  { upTo: 20, coins: 250 },
] as const;
/** Bônus de VIP ao chegar em N convites premiados */
export const INVITER_MILESTONES: Record<number, number> = { 10: 7, 20: 30 };

/** Prêmio do n-ésimo convite premiado (1 = primeiro). */
export function inviterReward(n: number) {
  const tier = INVITER_TIERS.find((t) => n <= t.upTo);
  if (!tier || n < 1) return { coins: 0, vipDays: 0 };
  return { coins: tier.coins, vipDays: INVITER_MILESTONES[n] ?? 0 };
}

/** Nick do cookie/link: só formato válido de nick. */
export function cleanRefNick(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^[A-Za-z0-9_.-]{3,24}$/.test(s) ? s : null;
}

/** Premia? Só o convidado verificado, uma vez, com quem convidou ativo e dentro do limite. */
export function rewardDecision(
  invitee: { id: string; referredById: string | null; referralRewardedAt: Date | null; ageVerification: string },
  inviter: { id: string; status: string } | null,
  alreadyRewarded: number,
): "reward" | "invitee-only" | "none" {
  if (!invitee.referredById || invitee.referralRewardedAt || invitee.ageVerification !== "APPROVED") return "none";
  if (!inviter || inviter.id === invitee.id || inviter.status !== "ACTIVE") return "none";
  return alreadyRewarded >= REFERRAL.maxRewarded ? "invitee-only" : "reward";
}
