import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFlood, limiter } from "@/lib/ratelimit";
import { can } from "@/lib/permissions";
import { assertSameOrigin, clientInfo, getCurrentUser } from "@/server/auth";
import { activeSanction, actorFor, canEnter, roomBySlug } from "@/server/rooms";

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|me|io|xyz|ly|gg)\b)/i;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  const actor = await actorFor(user, room.id);
  const denied = await canEnter(user, room, actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  if (!can(actor, "send")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { ip } = await clientInfo();
  if (!limiter("chat-user", 8, 1).take(user.id) || !limiter("chat-ip", 30, 3).take(ip))
    return NextResponse.json({ error: "Devagar! Você está enviando rápido demais." }, { status: 429 });

  const json = await req.json().catch(() => ({}));
  const body = String(json.body ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!body) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const mute = await activeSanction(room.id, user.id, "MUTE");
  if (mute) return NextResponse.json({ error: "Você está silenciado nesta sala." }, { status: 403 });

  const staffOrMod = actor.role === "OWNER" || actor.role === "MODERATOR" || actor.platformRole !== "USER";
  if (!staffOrMod) {
    if (!room.linksAllowed && LINK_RE.test(body)) return NextResponse.json({ error: "Links não são permitidos nesta sala." }, { status: 400 });
    const words = await db.roomBannedWord.findMany({ where: { roomId: room.id } });
    const lower = body.toLowerCase();
    if (words.some((w) => lower.includes(w.word.toLowerCase()))) return NextResponse.json({ error: "Sua mensagem contém uma palavra bloqueada nesta sala." }, { status: 400 });

    const recent = await db.message.findMany({
      where: { roomId: room.id, authorId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
      select: { body: true, createdAt: true },
      orderBy: { id: "desc" },
    });
    if (room.slowModeSeconds > 0 && recent[0] && Date.now() - recent[0].createdAt.getTime() < room.slowModeSeconds * 1000)
      return NextResponse.json({ error: `Modo lento: aguarde ${room.slowModeSeconds}s entre mensagens.` }, { status: 429 });
    if (isFlood(recent, body)) {
      await db.roomSanction.create({ data: { roomId: room.id, userId: user.id, type: "MUTE", reason: "Flood automático", issuedById: user.id, expiresAt: new Date(Date.now() + 5 * 60_000) } });
      await db.message.create({ data: { roomId: room.id, kind: "SYSTEM", body: `${user.nick} foi silenciado por 5 min (flood).` } });
      return NextResponse.json({ error: "Flood detectado: silenciado por 5 minutos." }, { status: 429 });
    }
  }

  const msg = await db.message.create({ data: { roomId: room.id, authorId: user.id, body } });
  // @menções: avisa até 5 pessoas citadas (que não bloquearam o autor)
  const nicks = [...new Set([...body.matchAll(/@([A-Za-z0-9_.]{3,20})/g)].map((m) => m[1]))].slice(0, 5);
  if (nicks.length) {
    const { notify } = await import("@/server/notify");
    const { isBlockedBetween } = await import("@/server/access");
    const targets = await db.user.findMany({ where: { nick: { in: nicks }, status: "ACTIVE" }, select: { id: true } });
    for (const t of targets) {
      if (t.id === user.id || (await isBlockedBetween(user.id, t.id))) continue;
      await notify(t.id, "MENTION", `@${user.nick} mencionou você em /${room.slug}: ${body.slice(0, 80)}`, user.id, room.slug);
    }
  }
  return NextResponse.json({ id: msg.id.toString() });
}
