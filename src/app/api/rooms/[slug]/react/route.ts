import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { REACTIONS } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { assertSameOrigin, getCurrentUser } from "@/server/auth";
import { actorFor, canEnter, roomBySlug } from "@/server/rooms";

/** Reagir a uma mensagem da sala (toggle). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (await canEnter(user, room, await actorFor(user, room.id))) return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  if (!limiter("chat-react", 30, 1).take(user.id)) return NextResponse.json({ error: "Devagar!" }, { status: 429 });
  const { messageId, emoji } = await req.json().catch(() => ({}));
  if (!/^\d+$/.test(String(messageId)) || !(REACTIONS as readonly string[]).includes(emoji)) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const id = BigInt(messageId);
  const msg = await db.message.findFirst({ where: { id, roomId: room.id, deletedAt: null } });
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  const key = { messageId_userId: { messageId: id, userId: user.id } };
  const existing = await db.messageReaction.findUnique({ where: key });
  if (existing?.emoji === emoji) await db.messageReaction.delete({ where: key });
  else await db.messageReaction.upsert({ where: key, create: { messageId: id, userId: user.id, emoji }, update: { emoji } });
  return NextResponse.json({ ok: true });
}
