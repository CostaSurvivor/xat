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
  const { passwordHash, ...profile } = u;
  void passwordHash;
  const [liveStreams, liveMessages] = await Promise.all([
    db.liveStream.findMany({ where: { hostId: u.id }, select: { id: true, title: true, startedAt: true, endedAt: true, tipTotal: true, peakViewers: true } }),
    db.liveMessage.findMany({ where: { authorId: u.id }, select: { streamId: true, kind: true, body: true, amount: true, createdAt: true } }),
  ]);
  const data = { exportedAt: new Date(), liveStreams, liveMessages: liveMessages.map((m) => ({ ...m, amount: m.amount ?? undefined })), profile, persons, consents, posts, comments, roomMessages: messages, privateMessagesSent: pms, follows, blocks, payments, inventory, media, accessLogs: access };
  const json = JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return new NextResponse(json, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="meus-dados-${u.nick}.json"` },
  });
}
