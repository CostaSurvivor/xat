import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { assertSameOrigin, currentSessionId, getCurrentUser } from "@/server/auth";
import { endpointHash } from "@/server/push";

const schema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "endpoint inválido"),
  keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(8).max(255) }),
});

/** Ativa o push neste aparelho (a inscrição fica presa à sessão de login atual). */
export async function POST(req: Request) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  const sessionId = await currentSessionId();
  if (!user || !sessionId) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!limiter("push-sub", 10, 10 / 3600).take(user.id)) return NextResponse.json({ error: "Devagar!" }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  if ((await db.pushSubscription.count({ where: { userId: user.id } })) >= 10)
    await db.pushSubscription.deleteMany({ where: { id: { in: (await db.pushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 1 })).map((s) => s.id) } } });
  const h = endpointHash(p.data.endpoint);
  // o mesmo aparelho pode trocar de conta, mas só se a inscrição anterior não estiver mais em uso (sessão encerrada)
  const prev = await db.pushSubscription.findUnique({ where: { endpointHash: h }, include: { session: { select: { expiresAt: true } } } });
  if (prev && prev.userId !== user.id && prev.session.expiresAt > new Date()) return NextResponse.json({ error: "Este aparelho já está ativo em outra conta. Saia dela primeiro." }, { status: 409 });
  const data = { userId: user.id, sessionId, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null };
  // o mesmo aparelho pode mudar de conta: a inscrição passa para quem está logado agora
  await db.pushSubscription.upsert({ where: { endpointHash: h }, create: { endpointHash: h, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

/** Desativa o push neste aparelho. */
export async function DELETE(req: Request) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await db.pushSubscription.deleteMany({ where: { userId: user.id, endpointHash: endpointHash(String(body.endpoint)) } });
  return NextResponse.json({ ok: true });
}
