"use server";

import { revalidatePath } from "next/cache";
import { opAllowed, type QueueKind } from "@/lib/modqueue";
import { requireStaff } from "@/server/auth";
import { handleReport, reviewVerification } from "@/app/actions/admin";
import { reviewEvent } from "@/app/actions/events";
import { reviewPlace } from "@/app/actions/places";

/** Uma ação da fila rápida: repassa para as mesmas ações das telas de verificação, eventos e denúncias. */
export async function queueAct(kind: QueueKind, id: string, op: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff();
  if (!opAllowed(kind, op)) return { ok: false, error: "Ação inválida" };
  const fd = new FormData();
  fd.set("op", op);
  if (note) fd.set(kind === "verification" ? "reason" : "note", note.slice(0, 255));
  if (kind === "verification") await reviewVerification(id, op === "approve", fd);
  else if (kind === "event") await reviewEvent(id, fd);
  else if (kind === "place") await reviewPlace(id, fd);
  else await handleReport(id, fd);
  revalidatePath("/admin/fila");
  revalidatePath("/admin");
  return { ok: true };
}
