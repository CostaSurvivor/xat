import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertSameOrigin } from "@/server/auth";
import { audit } from "@/server/notify";
import { endLive, liveCtx } from "@/server/live";

/** Ações de quem transmite / moderação: apagar mensagem, remover espectador, encerrar. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const ctx = await liveCtx((await params).id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { user, live, canMod, isHost } = ctx;
  if (!canMod) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const json = await req.json().catch(() => ({}));
  const action = String(json.action ?? "");
  const target = String(json.target ?? "");

  if (action === "delete") {
    if (!/^\d{1,20}$/.test(target)) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    await db.liveMessage.updateMany({ where: { id: BigInt(target), streamId: live.id }, data: { deletedAt: new Date() } });
  } else if (action === "kick") {
    if (target === live.hostId) return NextResponse.json({ error: "Não dá para remover quem transmite" }, { status: 400 });
    const u = await db.user.findUnique({ where: { id: target }, select: { nick: true } });
    if (!u) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    await db.liveBan.upsert({ where: { streamId_userId: { streamId: live.id, userId: target } }, create: { streamId: live.id, userId: target }, update: {} });
    await db.liveViewer.deleteMany({ where: { streamId: live.id, userId: target } });
    await db.liveMessage.create({ data: { streamId: live.id, kind: "SYSTEM", body: `${u.nick} foi removido da transmissão.` } });
  } else if (action === "end") {
    await endLive(live.id, isHost ? "Quem transmitia encerrou." : "Encerrada pela moderação.");
    if (!isHost) await audit(user.id, "live.end", "LIVE", live.id, { hostId: live.hostId });
  } else return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
