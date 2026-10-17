"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";

/** ✕ numa sugestão: não mostra mais esse perfil. */
export async function dismissSuggestion(targetId: string) {
  const user = await requireUser();
  if (typeof targetId !== "string" || targetId === user.id) return;
  await db.suggestionDismiss.createMany({ data: [{ userId: user.id, targetId }], skipDuplicates: true });
}
