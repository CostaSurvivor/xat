import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isStale } from "@/lib/live";
import { endLive, liveCtx, liveMessages, sweepLive, topTippers, touchLive, viewersOf } from "@/server/live";

/** Polling do Ao vivo: chat, gorjetas, espectadores e sinais WebRTC endereçados a mim. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveCtx((await params).id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { user, isHost, canMod } = ctx;
  let live = ctx.live;
  await sweepLive();
  if (live.status === "LIVE" && !isHost && isStale(live.lastBeatAt)) {
    await endLive(live.id, "Conexão de quem transmitia caiu");
    live = { ...live, status: "ENDED" };
  }
  if (live.status === "LIVE") await touchLive(live, user.id);

  const sp = new URL(req.url).searchParams;
  const after = sp.get("after");
  const sig = sp.get("sig");
  const [messages, viewers, top, signals, fresh, wallet, deleted] = await Promise.all([
    liveMessages(live.id, user.id, after ? BigInt(after) : undefined),
    viewersOf(live.id),
    topTippers(live.id),
    live.status === "LIVE"
      ? db.liveSignal.findMany({ where: { streamId: live.id, toId: user.id, ...(sig ? { id: { gt: BigInt(sig) } } : { createdAt: { gt: new Date(Date.now() - 30_000) } }) }, orderBy: { id: "asc" }, take: 50 })
      : Promise.resolve([]),
    db.liveStream.findUnique({ where: { id: live.id }, select: { tipTotal: true, tipGoal: true, goalLabel: true, peakViewers: true, status: true, endReason: true } }),
    db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
    db.liveMessage.findMany({ where: { streamId: live.id, deletedAt: { gt: new Date(Date.now() - 60_000) } }, select: { id: true } }),
  ]);
  const count = viewers.filter((v) => v.id !== live.hostId).length;
  if (fresh && count > fresh.peakViewers) await db.liveStream.update({ where: { id: live.id }, data: { peakViewers: count } });

  return NextResponse.json({
    now: Date.now(),
    status: fresh?.status ?? live.status,
    endReason: fresh?.endReason ?? null,
    tipTotal: fresh?.tipTotal ?? 0,
    tipGoal: fresh?.tipGoal ?? null,
    goalLabel: fresh?.goalLabel ?? null,
    viewers: count,
    peak: Math.max(fresh?.peakViewers ?? 0, count),
    viewerList: viewers.filter((v) => v.id !== live.hostId).slice(0, 100),
    top,
    messages,
    deleted: deleted.map((d) => d.id.toString()),
    signals: signals.map((s) => ({ id: s.id.toString(), from: s.fromId, kind: s.kind, payload: s.payload })),
    me: { isHost, canMod, balance: wallet?.balance ?? 0 },
  });
}
