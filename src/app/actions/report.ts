"use server";

import { z } from "zod";
import type { ReportReason, ReportTargetType } from "@prisma/client";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { requireUser } from "@/server/auth";

const PRIORITY: Record<ReportReason, number> = {
  POSSIBLE_MINOR: 100,
  NON_CONSENSUAL: 80,
  ILLEGAL_CONTENT: 80,
  HARASSMENT: 50,
  FAKE_PROFILE: 30,
  SPAM: 20,
  OTHER: 10,
};

const schema = z.object({
  targetType: z.enum(["USER", "POST", "COMMENT", "ROOM_MESSAGE", "PRIVATE_MESSAGE", "MEDIA", "ROOM", "LIVE", "EVENT"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum(["POSSIBLE_MINOR", "NON_CONSENSUAL", "ILLEGAL_CONTENT", "HARASSMENT", "FAKE_PROFILE", "SPAM", "OTHER"]),
  details: z.string().max(1000).optional(),
});

/** Snapshot do conteúdo denunciado + dono do conteúdo + mídias envolvidas. */
async function snapshot(type: ReportTargetType, id: string) {
  switch (type) {
    case "USER": {
      const u = await db.user.findUnique({ where: { id }, select: { id: true, nick: true, bio: true, avatarId: true } });
      return { userId: u?.id, evidence: u, mediaIds: [] as string[] };
    }
    case "POST": {
      const p = await db.post.findUnique({ where: { id }, include: { media: true } });
      return { userId: p?.authorId, evidence: p && { body: p.body, media: p.media.map((m) => m.mediaId) }, mediaIds: p?.media.map((m) => m.mediaId) ?? [] };
    }
    case "COMMENT": {
      const c = await db.postComment.findUnique({ where: { id } });
      return { userId: c?.authorId, evidence: c && { body: c.body, postId: c.postId }, mediaIds: [] };
    }
    case "ROOM_MESSAGE": {
      const m = await db.message.findUnique({ where: { id: BigInt(id) } });
      return { userId: m?.authorId ?? undefined, evidence: m && { body: m.body, roomId: m.roomId, mediaId: m.mediaId }, mediaIds: m?.mediaId ? [m.mediaId] : [] };
    }
    case "PRIVATE_MESSAGE": {
      const m = await db.privateMessage.findUnique({ where: { id: BigInt(id) } });
      return { userId: m?.senderId, evidence: m && { body: m.body, mediaId: m.mediaId }, mediaIds: m?.mediaId ? [m.mediaId] : [] };
    }
    case "MEDIA": {
      const m = await db.media.findUnique({ where: { id } });
      return { userId: m?.ownerId, evidence: m && { kind: m.kind, sha256: m.sha256 }, mediaIds: m ? [m.id] : [] };
    }
    case "ROOM": {
      const r = await db.room.findUnique({ where: { id } });
      return { userId: r?.ownerId ?? undefined, evidence: r && { slug: r.slug, name: r.name, description: r.description }, mediaIds: [] };
    }
    case "EVENT": {
      const e = await db.event.findUnique({ where: { id } });
      return { userId: e?.creatorId, evidence: e && { title: e.title, description: e.description, venue: e.venue, city: e.city, startsAt: e.startsAt }, mediaIds: e?.coverMediaId ? [e.coverMediaId] : [] };
    }
    case "LIVE": {
      const l = await db.liveStream.findUnique({ where: { id } });
      return { userId: l?.hostId, evidence: l && { title: l.title, status: l.status, startedAt: l.startedAt }, mediaIds: [] };
    }
  }
}

export async function submitReport(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!limiter("report", 10, 10 / 3600).take(user.id)) return { ok: false, message: "Muitas denúncias em pouco tempo." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Dados inválidos" };
  const d = parsed.data;
  let snap;
  try {
    snap = await snapshot(d.targetType, d.targetId);
  } catch {
    return { ok: false, message: "Conteúdo não encontrado" };
  }
  if (!snap?.evidence) return { ok: false, message: "Conteúdo não encontrado" };

  await db.report.create({
    data: {
      reporterId: user.id,
      targetType: d.targetType,
      targetId: d.targetId,
      targetUserId: snap.userId,
      reason: d.reason,
      details: d.details,
      priority: PRIORITY[d.reason],
      evidence: snap.evidence as any,
    },
  });

  // Possível menor: bloqueio IMEDIATO da mídia envolvida até revisão humana.
  if (d.reason === "POSSIBLE_MINOR" && snap.mediaIds.length) {
    await db.media.updateMany({ where: { id: { in: snap.mediaIds } }, data: { status: "QUARANTINED" } });
  }
  return { ok: true, message: "Denúncia enviada. Obrigado por proteger a comunidade." };
}
