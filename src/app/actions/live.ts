"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";
import { canBroadcast, startLive } from "@/server/live";

type R = { ok?: boolean; error?: string } | undefined;

const schema = z.object({
  title: z.string().trim().min(3, "Título muito curto").max(80),
  audience: z.enum(["ALL", "VIP"]),
  tipGoal: z.union([z.literal(""), z.coerce.number().int().min(10, "Meta mínima: 10").max(1_000_000)]).optional(),
  goalLabel: z.string().trim().max(60).optional(),
  rules: z.literal("on", { errorMap: () => ({ message: "Confirme as regras para transmitir." }) }),
});

export async function startLiveAction(_: R, formData: FormData): Promise<R> {
  const user = await requireUser();
  const denied = canBroadcast(user);
  if (denied) return { error: denied };
  if (!limiter("live-start", 6, 6 / 3600).take(user.id)) return { error: "Muitas transmissões iniciadas. Tente mais tarde." };
  const p = schema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const goal = typeof d.tipGoal === "number" ? d.tipGoal : null;
  const live = await startLive(user, { title: d.title, audience: d.audience, tipGoal: goal, goalLabel: goal ? d.goalLabel || null : null });
  redirect(`/ao-vivo/${live.id}`);
}

/** Moderação: encerrar transmissão pelo painel. */
export async function adminEndLive(id: string, reason: string) {
  const { requireStaff } = await import("@/server/auth");
  const { endLive } = await import("@/server/live");
  const { audit } = await import("@/server/notify");
  const { revalidatePath } = await import("next/cache");
  const staff = await requireStaff();
  if (await endLive(id, `Encerrada pela moderação${reason ? `: ${reason.slice(0, 80)}` : "."}`)) await audit(staff.id, "live.end", "LIVE", id);
  revalidatePath("/admin/ao-vivo");
}
