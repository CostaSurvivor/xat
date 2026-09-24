import "server-only";
import type { NotificationKind } from "@prisma/client";
import { db } from "@/lib/db";

export async function notify(userId: string, kind: NotificationKind, text: string, actorId?: string, refId?: string) {
  if (actorId && actorId === userId) return;
  await db.notification.create({ data: { userId, kind, text: text.slice(0, 255), actorId, refId } });
}

export async function audit(actorId: string | null, action: string, targetType?: string, targetId?: string, meta?: object) {
  await db.auditLog.create({ data: { actorId, action, targetType, targetId, meta: meta as any } });
}
