"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { PUSH_GROUPS, type PushGroup } from "@/lib/push";
import { requireUser } from "@/server/auth";
import { sendPushTo } from "@/server/push";

export async function savePushPrefs(_: { ok?: boolean; error?: string } | undefined, fd: FormData) {
  const user = await requireUser();
  const groups = Object.fromEntries((Object.keys(PUSH_GROUPS) as PushGroup[]).map((g) => [g, fd.get(`g_${g}`) === "on"]));
  await db.user.update({ where: { id: user.id }, data: { pushPrefs: { discreet: fd.get("discreet") === "on", groups } } });
  revalidatePath("/perfil");
  return { ok: true };
}

export async function sendTestPush() {
  const user = await requireUser();
  if (!limiter("push-test", 3, 3 / 600).take(user.id)) return { ok: false, error: "Aguarde um pouco para testar de novo." };
  const n = await sendPushTo(user.id, { title: "Nova notificação", body: "Tudo certo! As notificações estão funcionando 🔔", url: "/notificacoes", tag: "teste" });
  return n ? { ok: true } : { ok: false, error: "Nenhum aparelho ativo. Ative as notificações primeiro." };
}
