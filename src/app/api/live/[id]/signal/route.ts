import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { signalAllowed } from "@/lib/live";
import { assertSameOrigin } from "@/server/auth";
import { liveCtx } from "@/server/live";

/** Sinalização WebRTC (offer/answer sem trickle, hello/bye/full). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const ctx = await liveCtx((await params).id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { user, live, isHost } = ctx;
  if (live.status !== "LIVE") return NextResponse.json({ error: "A transmissão terminou." }, { status: 400 });
  if (!limiter(isHost ? "live-sig-host" : "live-sig", isHost ? 200 : 20, isHost ? 20 : 1).take(user.id))
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });

  const json = await req.json().catch(() => ({}));
  const kind = String(json.kind ?? "");
  const to = isHost ? String(json.to ?? "") : live.hostId;
  if (!signalAllowed(kind, user.id, to, live.hostId)) return NextResponse.json({ error: "Sinal inválido" }, { status: 400 });
  const payload = json.payload == null ? null : String(json.payload);
  if (payload && payload.length > 20_000) return NextResponse.json({ error: "Sinal grande demais" }, { status: 400 });
  if ((kind === "offer" || kind === "answer") && !payload?.includes("v=0")) return NextResponse.json({ error: "SDP inválido" }, { status: 400 });
  if (isHost) {
    // só manda para quem está (ou esteve há pouco) assistindo
    const v = await db.liveViewer.findUnique({ where: { streamId_userId: { streamId: live.id, userId: to } } });
    if (!v) return NextResponse.json({ error: "Espectador não encontrado" }, { status: 404 });
  }
  if (kind === "bye" && !isHost) await db.liveViewer.updateMany({ where: { streamId: live.id, userId: user.id }, data: { lastSeenAt: new Date(0) } });
  await db.liveSignal.create({ data: { streamId: live.id, fromId: user.id, toId: to, kind, payload } });
  return NextResponse.json({ ok: true });
}
