import { describe, expect, it } from "vitest";
import { REFERRAL, cleanRefNick, rewardDecision } from "@/lib/referral";

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
