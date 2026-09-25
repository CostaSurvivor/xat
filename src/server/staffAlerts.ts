import "server-only";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { notify } from "@/server/notify";

/** Link especial dos avisos da equipe (abre a fila rápida). */
export const STAFF_QUEUE_REF = "fila";

/**
 * Selfie nova na fila: avisa admins e moderadores (no site e no celular).
 * No máximo 1 aviso a cada 10 min por pessoa da equipe, com o total pendente. Nunca derruba o envio.
 */
export async function alertStaffVerification() {
  try {
    const [staff, pending] = await Promise.all([
      db.user.findMany({ where: { role: { in: ["ADMIN", "MODERATOR"] }, status: "ACTIVE" }, select: { id: true } }),
      db.verificationRequest.count({ where: { status: "PENDING" } }),
    ]);
    for (const s of staff) {
      if (!limiter("staff-verif-alert", 1, 1 / 600).take(s.id)) continue;
      await notify(s.id, "VERIFICATION", `🪪 ${pending === 1 ? "1 verificação nova" : `${pending} verificações`} na fila. Aprovar libera os bônus de convite.`, undefined, STAFF_QUEUE_REF);
    }
  } catch (e) {
    console.error("alertStaffVerification", e);
  }
}
