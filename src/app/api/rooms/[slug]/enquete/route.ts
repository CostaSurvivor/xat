import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { canManagePoll, isOpen, roomPollSchema } from "@/lib/roompolls";
import { assertSameOrigin, getCurrentUser } from "@/server/auth";
import { activeSanction, actorFor, canEnter, roomBySlug } from "@/server/rooms";
import { closePoll } from "@/server/roompolls";
import { audit } from "@/server/notify";

async function ctx(req: Request, slug: string) {
  if (!(await assertSameOrigin(req))) return { err: NextResponse.json({ error: "Origem inválida" }, { status: 403 }) };
  const user = await getCurrentUser();
  if (!user) return { err: NextResponse.json({ error: "Faça login" }, { status: 401 }) };
  const room = await roomBySlug(slug);
  if (!room) return { err: NextResponse.json({ error: "Sala não encontrada" }, { status: 404 }) };
  const actor = await actorFor(user, room.id);
  const denied = await canEnter(user, room, actor);
  if (denied) return { err: NextResponse.json({ error: denied }, { status: 403 }) };
  return { user, room, actor };
}

/** Abrir enquete (dono, moderador da sala ou equipe). Uma aberta por vez. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await ctx(req, (await params).slug);
  if (c.err) return c.err;
  const { user, room, actor } = c;
  if (!canManagePoll(actor)) return NextResponse.json({ error: "Só moderadores abrem enquetes." }, { status: 403 });
  if (!limiter("roompoll", 5, 5 / 3600).take(user.id)) return NextResponse.json({ error: "Muitas enquetes em pouco tempo." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const p = roomPollSchema.safeParse({ question: body.question, options: Array.isArray(body.options) ? body.options.filter((o: unknown) => String(o ?? "").trim()) : [], minutes: Number(body.minutes) });
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
  const last = await db.roomPoll.findFirst({ where: { roomId: room.id }, orderBy: { createdAt: "desc" } });
  if (last && isOpen(last)) return NextResponse.json({ error: "Já tem uma enquete aberta. Encerre antes de abrir outra." }, { status: 409 });
  const poll = await db.roomPoll.create({ data: { roomId: room.id, creatorId: user.id, question: p.data.question, options: p.data.options, endsAt: new Date(Date.now() + p.data.minutes * 60_000) } });
  await db.message.create({ data: { roomId: room.id, authorId: user.id, kind: "SYSTEM", body: `📊 Nova enquete: “${poll.question}”. Vote no topo da sala!` } });
  await audit(user.id, "roompoll.open", "Room", room.id, { pollId: poll.id });
  return NextResponse.json({ ok: true, id: poll.id });
}

/** Votar (ou trocar o voto) enquanto está aberta. */
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await ctx(req, (await params).slug);
  if (c.err) return c.err;
  const { user, room } = c;
  if (!limiter("roompoll-vote", 20, 1).take(user.id)) return NextResponse.json({ error: "Devagar!" }, { status: 429 });
  if (await activeSanction(room.id, user.id, "MUTE")) return NextResponse.json({ error: "Você está silenciado nesta sala." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const poll = await db.roomPoll.findUnique({ where: { id: String(body.pollId ?? "") } });
  if (!poll || poll.roomId !== room.id) return NextResponse.json({ error: "Enquete não encontrada" }, { status: 404 });
  if (!isOpen(poll)) return NextResponse.json({ error: "Esta enquete já encerrou." }, { status: 409 });
  const option = Number(body.option);
  if (!Number.isInteger(option) || option < 0 || option >= (poll.options as string[]).length) return NextResponse.json({ error: "Opção inválida" }, { status: 400 });
  await db.roomPollVote.upsert({ where: { pollId_userId: { pollId: poll.id, userId: user.id } }, create: { pollId: poll.id, userId: user.id, option }, update: { option } });
  return NextResponse.json({ ok: true });
}

/** Encerrar antes do prazo (quem pode abrir). */
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await ctx(req, (await params).slug);
  if (c.err) return c.err;
  const { user, room, actor } = c;
  if (!canManagePoll(actor)) return NextResponse.json({ error: "Só moderadores encerram enquetes." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const ok = await closePoll(String(body.pollId ?? ""), room.id);
  if (ok) await audit(user.id, "roompoll.close", "Room", room.id, { pollId: body.pollId });
  return NextResponse.json({ ok });
}
