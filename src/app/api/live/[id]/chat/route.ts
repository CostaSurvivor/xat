import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFlood, limiter } from "@/lib/ratelimit";
import { assertSameOrigin, clientInfo } from "@/server/auth";
import { liveCtx } from "@/server/live";

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|me|io|xyz|ly|gg)\b)/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const ctx = await liveCtx((await params).id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { user, live, canMod } = ctx;
  if (live.status !== "LIVE") return NextResponse.json({ error: "A transmissão terminou." }, { status: 400 });

  const { ip } = await clientInfo();
  if (!limiter("live-chat-user", 6, 1).take(user.id) || !limiter("live-chat-ip", 30, 3).take(ip))
    return NextResponse.json({ error: "Devagar! Você está enviando rápido demais." }, { status: 429 });
  const json = await req.json().catch(() => ({}));
  const body = String(json.body ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!body) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  if (!canMod) {
    if (LINK_RE.test(body)) return NextResponse.json({ error: "Links não são permitidos no ao vivo." }, { status: 400 });
    const recent = await db.liveMessage.findMany({
      where: { streamId: live.id, authorId: user.id, kind: "TEXT", createdAt: { gt: new Date(Date.now() - 60_000) } },
      select: { body: true, createdAt: true },
      orderBy: { id: "desc" },
    });
    if (isFlood(recent, body)) return NextResponse.json({ error: "Calma: mensagens repetidas ou rápidas demais." }, { status: 429 });
  }
  const m = await db.liveMessage.create({ data: { streamId: live.id, authorId: user.id, body } });
  return NextResponse.json({ id: m.id.toString() });
}
