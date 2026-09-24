import { NextResponse } from "next/server";
import { handleWebhook } from "@/server/payments";

/** Webhook dos gateways de pagamento (assinatura validada pelo provider). */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  const r = await handleWebhook(provider, req.headers, raw);
  return new NextResponse(r.body, { status: r.status });
}
