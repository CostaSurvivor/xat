import { describe, expect, it } from "vitest";
import { REFERRAL, cleanRefNick, inviterReward, rewardDecision } from "@/lib/referral";

const inv = { id: "b", referredById: "a", referralRewardedAt: null, ageVerification: "APPROVED" };
const a = { id: "a", status: "ACTIVE" };

describe("convites", () => {
  it("link só aceita nick válido", () => {
    expect(cleanRefNick("CasalSafado_SP")).toBe("CasalSafado_SP");
    expect(cleanRefNick("a")).toBeNull();
    expect(cleanRefNick("x<script>")).toBeNull();
    expect(cleanRefNick(undefined)).toBeNull();
  });
  it("premia só convidado verificado, uma vez", () => {
    expect(rewardDecision(inv, a, 0)).toBe("reward");
    expect(rewardDecision({ ...inv, ageVerification: "PENDING" }, a, 0)).toBe("none");
    expect(rewardDecision({ ...inv, referralRewardedAt: new Date() }, a, 0)).toBe("none");
    expect(rewardDecision({ ...inv, referredById: null }, a, 0)).toBe("none");
  });
  it("quem convidou precisa estar ativo e não é ele mesmo; limite por pessoa", () => {
    expect(rewardDecision(inv, { id: "a", status: "BANNED" }, 0)).toBe("none");
    expect(rewardDecision({ ...inv, referredById: "b" }, { id: "b", status: "ACTIVE" }, 0)).toBe("none");
    expect(rewardDecision(inv, null, 0)).toBe("none");
    expect(rewardDecision(inv, a, REFERRAL.maxRewarded)).toBe("invitee-only");
  });
});

describe("escada de prêmios", () => {
  it("vale mais a cada faixa e dá VIP no 10º e no 20º", () => {
    expect(inviterReward(1)).toEqual({ coins: 100, vipDays: 0 });
    expect(inviterReward(5)).toEqual({ coins: 100, vipDays: 0 });
    expect(inviterReward(6)).toEqual({ coins: 150, vipDays: 0 });
    expect(inviterReward(10)).toEqual({ coins: 150, vipDays: 7 });
    expect(inviterReward(11)).toEqual({ coins: 200, vipDays: 0 });
    expect(inviterReward(20)).toEqual({ coins: 250, vipDays: 30 });
    expect(inviterReward(21)).toEqual({ coins: 0, vipDays: 0 });
  });
  it("total dos 20 convites", () => {
    let total = 0;
    for (let n = 1; n <= REFERRAL.maxRewarded; n++) total += inviterReward(n).coins;
    expect(total).toBe(3500);
  });
});
