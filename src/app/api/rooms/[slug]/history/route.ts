import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { actorFor, canEnter, messagesView, roomBySlug } from "@/server/rooms";

/** Mensagens anteriores (paginação por cursor). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (await canEnter(user, room, await actorFor(user, room.id))) return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  const before = new URL(req.url).searchParams.get("before");
  if (!before || !/^\d+$/.test(before)) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: await messagesView(room.id, user.id, { before: BigInt(before), take: 50 }) });
}
