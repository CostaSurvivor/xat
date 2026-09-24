import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { can, type RoomAction } from "@/lib/permissions";
import { assertSameOrigin, getCurrentUser } from "@/server/auth";
import { actorFor, roomBySlug } from "@/server/rooms";
import { audit } from "@/server/notify";

const schema = z.object({
  action: z.enum(["delete_message", "mute", "kick", "ban", "clear", "pin", "unpin", "set_slowmode", "unmute", "unban"]),
  targetUserId: z.string().optional(),
  messageId: z.string().regex(/^\d+$/).optional(),
  minutes: z.number().int().min(0).max(60 * 24 * 365).optional(),
  seconds: z.number().int().min(0).max(300).optional(),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const room = await roomBySlug((await params).slug);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const d = parsed.data;
  const actor = await actorFor(user, room.id);

  const perm: RoomAction =
    d.action === "unpin" ? "pin" : d.action === "unmute" ? "mute" : d.action === "unban" ? "ban" : (d.action as RoomAction);

  let target;
  let targetNick = "";
  if (d.targetUserId) {
    const tu = await db.user.findUnique({ where: { id: d.targetUserId } });
    if (!tu) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    target = await actorFor(tu, room.id);
    targetNick = tu.nick;
  }
  if (!can(actor, perm, target)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const sys = (body: string) => db.message.create({ data: { roomId: room.id, kind: "SYSTEM", body } });
  const until = d.minutes ? new Date(Date.now() + d.minutes * 60_000) : null;

  switch (d.action) {
    case "delete_message":
      if (!d.messageId) break;
      await db.message.updateMany({ where: { id: BigInt(d.messageId), roomId: room.id }, data: { deletedAt: new Date() } });
      break;
    case "clear":
      await db.message.updateMany({ where: { roomId: room.id, deletedAt: null }, data: { deletedAt: new Date() } });
      await sys(`${user.nick} limpou o chat.`);
      break;
    case "pin": {
      if (!d.messageId) break;
      // só mensagens desta sala (senão daria para ler outras salas pelo "fixado")
      const msg = await db.message.findFirst({ where: { id: BigInt(d.messageId), roomId: room.id, deletedAt: null }, select: { id: true } });
      if (!msg) return NextResponse.json({ error: "Mensagem não encontrada nesta sala" }, { status: 404 });
      await db.room.update({ where: { id: room.id }, data: { pinnedMessageId: msg.id } });
      break;
    }
    case "unpin":
      await db.room.update({ where: { id: room.id }, data: { pinnedMessageId: null } });
      break;
    case "set_slowmode":
      await db.room.update({ where: { id: room.id }, data: { slowModeSeconds: d.seconds ?? 0 } });
      await sys(d.seconds ? `Modo lento ativado: ${d.seconds}s.` : "Modo lento desativado.");
      break;
    case "mute":
      await db.roomSanction.create({ data: { roomId: room.id, userId: d.targetUserId!, type: "MUTE", reason: d.reason, issuedById: user.id, expiresAt: until ?? new Date(Date.now() + 10 * 60_000) } });
      await sys(`${targetNick} foi silenciado${d.minutes ? ` por ${d.minutes} min` : " por 10 min"}.`);
      break;
    case "unmute":
      await db.roomSanction.updateMany({ where: { roomId: room.id, userId: d.targetUserId!, type: "MUTE", revokedAt: null }, data: { revokedAt: new Date() } });
      break;
    case "kick":
      await db.roomPresence.deleteMany({ where: { roomId: room.id, userId: d.targetUserId! } });
      // expulsão = ban curto de 2 minutos
      await db.roomSanction.create({ data: { roomId: room.id, userId: d.targetUserId!, type: "BAN", reason: d.reason ?? "Expulso", issuedById: user.id, expiresAt: new Date(Date.now() + 2 * 60_000) } });
      await sys(`${targetNick} foi expulso da sala.`);
      break;
    case "ban":
      await db.roomPresence.deleteMany({ where: { roomId: room.id, userId: d.targetUserId! } });
      await db.roomSanction.create({ data: { roomId: room.id, userId: d.targetUserId!, type: "BAN", reason: d.reason, issuedById: user.id, expiresAt: until } });
      await sys(`${targetNick} foi banido${until ? ` por ${d.minutes} min` : " permanentemente"}.`);
      break;
    case "unban":
      await db.roomSanction.updateMany({ where: { roomId: room.id, userId: d.targetUserId!, type: "BAN", revokedAt: null }, data: { revokedAt: new Date() } });
      break;
  }
  await audit(user.id, `room.${d.action}`, "Room", room.id, { target: d.targetUserId, messageId: d.messageId });
  return NextResponse.json({ ok: true });
}
