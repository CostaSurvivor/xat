import "server-only";
import type { NotificationKind } from "@prisma/client";
import { db } from "@/lib/db";

export async function notify(userId: string, kind: NotificationKind, text: string, actorId?: string, refId?: string) {
  if (actorId && actorId === userId) return;
  await db.notification.create({ data: { userId, kind, text: text.slice(0, 255), actorId, refId } });
  // push no celular (se a pessoa ativou): em segundo plano, nunca atrasa nem quebra a ação
  void import("./push").then((m) => m.pushNotification(userId, kind, text, { refId, actorId }));
}

export async function audit(actorId: string | null, action: string, targetType?: string, targetId?: string, meta?: object) {
  await db.auditLog.create({ data: { actorId, action, targetType, targetId, meta: meta as any } });
}
