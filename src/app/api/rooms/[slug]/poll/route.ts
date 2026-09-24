import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { stylesFor } from "@/server/styles";
import { activeSanction, actorFor, canEnter, messagesView, onlineList, roomBySlug, touchPresence } from "@/server/rooms";

/** Polling do chat (funciona em qualquer hospedagem, sem WebSocket/Redis). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const actor = await actorFor(user, room.id);
  const denied = await canEnter(user, room, actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const after = sp.get("after");
  const since = sp.get("since");
  const justEntered = await touchPresence(room.id, user.id, sp.get("typing") === "1");

  if (justEntered) {
    const st = (await stylesFor([user.id]))[user.id];
    if (st?.entry && !st.powers.includes("INVISIBLE")) {
      await db.message.create({ data: { roomId: room.id, authorId: user.id, kind: "SYSTEM", body: `entry:${st.entry.effect}` } });
    }
  }

  const [messages, online, mute, deleted, fresh] = await Promise.all([
    messagesView(room.id, user.id, { after: after ? BigInt(after) : undefined }),
    onlineList(room.id, user),
    activeSanction(room.id, user.id, "MUTE"),
    since
      ? db.message.findMany({ where: { roomId: room.id, deletedAt: { gte: new Date(Number(since) - 5000) } }, select: { id: true } })
      : Promise.resolve([]),
    db.room.findUnique({ where: { id: room.id }, select: { pinnedMessageId: true, slowModeSeconds: true } }),
  ]);
  const pinned = fresh?.pinnedMessageId ? await db.message.findUnique({ where: { id: fresh.pinnedMessageId }, include: { author: { select: { nick: true } } } }) : null;

  return NextResponse.json({
    now: Date.now(),
    messages,
    online,
    deleted: deleted.map((d) => d.id.toString()),
    me: { role: actor.role, platformRole: actor.platformRole, mutedUntil: mute ? (mute.expiresAt?.toISOString() ?? "sempre") : null },
    slowMode: fresh?.slowModeSeconds ?? 0,
    pinned: pinned && !pinned.deletedAt ? { id: pinned.id.toString(), body: pinned.body, nick: pinned.author?.nick ?? "" } : null,
  });
}
