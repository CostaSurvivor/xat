import { NextResponse } from "next/server";
import { limiter } from "@/lib/ratelimit";
import { tipError } from "@/lib/live";
import { InsufficientFunds } from "@/server/ledger";
import { assertSameOrigin, isVerified } from "@/server/auth";
import { liveCtx, tipLive } from "@/server/live";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertSameOrigin(req))) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const ctx = await liveCtx((await params).id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { user, live, isHost } = ctx;
  if (isHost) return NextResponse.json({ error: "Não dá para dar gorjeta para si mesmo." }, { status: 400 });
  if (!isVerified(user)) return NextResponse.json({ error: "Verifique seu perfil para dar gorjetas." }, { status: 403 });
  if (!limiter("live-tip", 10, 10 / 60).take(user.id)) return NextResponse.json({ error: "Muitas gorjetas seguidas, aguarde um pouco." }, { status: 429 });

  const json = await req.json().catch(() => ({}));
  const amount = Number(json.amount);
  const err = tipError(amount);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const key = String(json.key ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (key.length < 8) return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  const message = String(json.message ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  try {
    await tipLive(user.id, live, amount, message, `tip:${user.id}:${key}`);
  } catch (e) {
    const msg = e instanceof InsufficientFunds ? "Saldo insuficiente" : e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
