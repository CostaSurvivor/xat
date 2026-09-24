import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { PIN_POWER_MINUTES } from "@/lib/items";
import { assertSameOrigin, getCurrentUser } from "@/server/auth";
import { actorFor, canEnter, roomBySlug } from "@/server/rooms";
import { stylesFor } from "@/server/styles";

/** Poder "Fixar mensagem": fixa a PRÓPRIA mensagem por alguns minutos, se não houver outra fixada. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  const denied = await canEnter(user, room, await actorFor(user, room.id));
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  if (!(await stylesFor([user.id]))[user.id]?.powers.includes("PIN_MESSAGE"))
    return NextResponse.json({ error: "Você precisa do poder 📌 Fixar mensagem (Loja)." }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const id = String(json.messageId ?? "");
  if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  const msg = await db.message.findUnique({ where: { id: BigInt(id) } });
  if (!msg || msg.roomId !== room.id || msg.authorId !== user.id || msg.kind !== "TEXT" || msg.deletedAt)
    return NextResponse.json({ error: "Só dá para fixar uma mensagem sua desta sala." }, { status: 400 });
  const fresh = await db.room.findUnique({ where: { id: room.id }, select: { pinnedMessageId: true } });
  if (fresh?.pinnedMessageId) return NextResponse.json({ error: "Já existe uma mensagem fixada. Aguarde ela sair." }, { status: 409 });
  if (!limiter("pin-power", 1, 1 / 900).take(`${user.id}:${room.id}`))
    return NextResponse.json({ error: "Você pode fixar uma mensagem a cada 15 minutos nesta sala." }, { status: 429 });

  await db.room.update({ where: { id: room.id }, data: { pinnedMessageId: msg.id } });
  // registro visível + controle de expiração (lido pelo polling)
  await db.message.create({ data: { roomId: room.id, authorId: user.id, kind: "SYSTEM", body: `pin:${msg.id}` } });
  return NextResponse.json({ ok: true, minutes: PIN_POWER_MINUTES });
}
