/** Convide amigos: regras puras (testadas em tests/referral.test.ts). */

export const REFERRAL = {
  /** Pimentas para quem convidou e para quem foi convidado, quando o convidado é verificado */
  inviterCoins: 100,
  inviteeCoins: 100,
  /** convites premiados por pessoa */
  maxRewarded: 20,
  cookie: "ref",
  cookieDays: 30,
};

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
