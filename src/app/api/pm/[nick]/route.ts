import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { assertSameOrigin, getCurrentUser } from "@/server/auth";
import { canMessage, findConversation, markRead, pairOf, pmMessages } from "@/server/pm";

async function other(nick: string) {
  return db.user.findFirst({ where: { nick: decodeURIComponent(nick) } });
}

export async function GET(req: Request, { params }: { params: Promise<{ nick: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const o = await other((await params).nick);
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const conv = await findConversation(user.id, o.id);
  if (!conv) return NextResponse.json({ messages: [] });
  const after = new URL(req.url).searchParams.get("after");
  const messages = await pmMessages(conv.id, user.id, after && after !== "0" ? BigInt(after) : undefined);
  if (messages.some((m) => !m.mine)) await markRead(conv.id, user.id);
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ nick: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const o = await other((await params).nick);
  if (!o) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!limiter("pm", 10, 1).take(user.id)) return NextResponse.json({ error: "Devagar!" }, { status: 429 });
  const denied = await canMessage(user, o);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = String((await req.json().catch(() => ({}))).body ?? "").trim().slice(0, 2000);
  if (!body) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  const pair = pairOf(user.id, o.id);
  const conv = await db.conversation.upsert({ where: { userAId_userBId: pair }, create: pair, update: {} });
  const m = await db.privateMessage.create({ data: { conversationId: conv.id, senderId: user.id, body } });
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: m.createdAt, lastSenderId: user.id } });
  return NextResponse.json({ id: m.id.toString() });
}
