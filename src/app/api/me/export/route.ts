import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";

/** LGPD art. 18: portabilidade/acesso. Exporta os dados do titular em JSON. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "login" }, { status: 401 });
  const [persons, consents, posts, comments, messages, pms, follows, blocks, payments, inventory, media, access] = await Promise.all([
    db.profilePerson.findMany({ where: { userId: u.id } }),
    db.consentRecord.findMany({ where: { userId: u.id } }),
    db.post.findMany({ where: { authorId: u.id } }),
    db.postComment.findMany({ where: { authorId: u.id } }),
    db.message.findMany({ where: { authorId: u.id }, take: 5000 }),
    db.privateMessage.findMany({ where: { senderId: u.id }, take: 5000 }),
    db.follow.findMany({ where: { followerId: u.id } }),
    db.block.findMany({ where: { blockerId: u.id } }),
    db.payment.findMany({ where: { userId: u.id } }),
    db.inventoryItem.findMany({ where: { userId: u.id }, include: { item: { select: { name: true } } } }),
    db.media.findMany({ where: { ownerId: u.id }, select: { id: true, kind: true, createdAt: true, status: true } }),
    db.accessLog.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  // segredos de login não saem no arquivo (se vazar, não compromete a conta)
  const { passwordHash, twoFactorSecret, ...profile } = u;
  void passwordHash; void twoFactorSecret;
  void passwordHash;
  const [liveStreams, liveMessages] = await Promise.all([
    db.liveStream.findMany({ where: { hostId: u.id }, select: { id: true, title: true, startedAt: true, endedAt: true, tipTotal: true, peakViewers: true } }),
    db.liveMessage.findMany({ where: { authorId: u.id }, select: { streamId: true, kind: true, body: true, amount: true, createdAt: true } }),
  ]);
  const [testimonialsReceived, testimonialsWritten] = await Promise.all([
    db.testimonial.findMany({ where: { profileId: u.id }, select: { authorId: true, body: true, metInPerson: true, status: true, createdAt: true } }),
    db.testimonial.findMany({ where: { authorId: u.id }, select: { profileId: true, body: true, metInPerson: true, status: true, createdAt: true } }),
  ]);
  const albums = await db.album.findMany({ where: { ownerId: u.id }, select: { id: true, name: true, emoji: true, visibility: true, createdAt: true } });
  const stories = await db.story.findMany({ where: { authorId: u.id }, select: { mediaId: true, caption: true, audience: true, createdAt: true, expiresAt: true, deletedAt: true, _count: { select: { views: true } } } });
  const groups = await db.groupMember.findMany({ where: { userId: u.id }, select: { joinedAt: true, group: { select: { slug: true, name: true } } } });
  const [events, eventRsvps] = await Promise.all([
    db.event.findMany({ where: { creatorId: u.id }, select: { id: true, title: true, startsAt: true, city: true, state: true, venue: true, status: true, createdAt: true } }),
    db.eventRsvp.findMany({ where: { userId: u.id }, select: { eventId: true, status: true, createdAt: true } }),
  ]);
  const [visitsReceived, visitsMade] = await Promise.all([
    db.profileVisit.findMany({ where: { visitedId: u.id }, select: { visitorId: true, count: true, firstAt: true, lastAt: true } }),
    db.profileVisit.findMany({ where: { visitorId: u.id }, select: { visitedId: true, count: true, firstAt: true, lastAt: true } }),
  ]);
  const data = { exportedAt: new Date(), albums, stories, groups, testimonialsReceived, testimonialsWritten, events, eventRsvps, visitsReceived, visitsMade, liveStreams, liveMessages: liveMessages.map((m) => ({ ...m, amount: m.amount ?? undefined })), profile, persons, consents, posts, comments, roomMessages: messages, privateMessagesSent: pms, follows, blocks, payments, inventory, media, accessLogs: access };
  const json = JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return new NextResponse(json, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="meus-dados-${u.nick}.json"` },
  });
}
