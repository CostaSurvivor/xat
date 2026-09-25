"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CURRENCY_NAME } from "@/lib/config";
import { ONBOARDING_REWARD, rewardKey } from "@/lib/onboarding";
import { requireUser } from "@/server/auth";
import { grantReward } from "@/server/ledger";
import { notify } from "@/server/notify";
import { onboardingState } from "@/server/onboarding";

/** Resgata o bônus uma única vez, só com todos os passos concluídos (conferidos de novo no servidor). */
export async function claimOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const st = await onboardingState(user);
  if (st.claimed) return { ok: false, error: "Bônus já resgatado." };
  if (!st.progress.complete) return { ok: false, error: "Complete todos os passos primeiro." };
  const r = await grantReward(user.id, ONBOARDING_REWARD, rewardKey(user.id), "Bônus de primeiros passos");
  if (r.created) await notify(user.id, "COINS_CREDITED", `🎉 +${ONBOARDING_REWARD} ${CURRENCY_NAME} de bônus por completar os primeiros passos!`);
  revalidatePath("/feed");
  return { ok: true };
}

export async function hideOnboarding() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { onboardingHiddenAt: new Date() } });
  revalidatePath("/feed");
}
