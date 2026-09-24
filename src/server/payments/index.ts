import "server-only";
import { db } from "@/lib/db";
import { creditPayment } from "@/server/ledger";
import { exampleGateway } from "./exampleGateway";
import { manualPix } from "./manualPix";
import type { PaymentProvider } from "./types";

const PROVIDERS: Record<string, PaymentProvider> = {
  [manualPix.id]: manualPix,
  [exampleGateway.id]: exampleGateway,
};

export function getProvider(id?: string | null): PaymentProvider {
  return PROVIDERS[id || process.env.PAYMENT_PROVIDER || "pix_manual"] ?? manualPix;
}

export function providerById(id: string) {
  return PROVIDERS[id];
}

/**
 * Devolve o Pix copia-e-cola do pedido. Pix manual: gerado na hora (estático).
 * Gateway: cobrança criada UMA vez e guardada no pedido (reabrir a página não duplica).
 */
export async function chargeFor(
  p: { id: string; code: string; provider: string; amountCents: number; packageName: string; providerRef: string | null; chargeData: string | null },
  user: { id: string; email: string; nick: string },
) {
  const provider = getProvider(p.provider);
  if (p.provider !== "pix_manual" && p.chargeData) return p.chargeData;
  const charge = await provider.createCharge({ paymentId: p.id, code: p.code, amountCents: p.amountCents, description: p.packageName, customer: user });
  if (charge.kind === "pix_static") return charge.payload;
  const data = charge.kind === "redirect" ? charge.url : charge.payload;
  await db.payment.update({ where: { id: p.id }, data: { providerRef: charge.providerRef, chargeData: data } });
  return data;
}

/**
 * Processa um webhook de forma idempotente:
 * 1) grava WebhookEvent (único por provider+eventId) — reentrega vira no-op;
 * 2) se PAID, credita via ledger com chave payment:<id> (também idempotente).
 */
export async function handleWebhook(providerId: string, headers: Headers, rawBody: string) {
  const provider = providerById(providerId);
  if (!provider?.parseWebhook) return { status: 404 as const, body: "provider desconhecido" };
  let evt;
  try {
    evt = await provider.parseWebhook({ headers, rawBody });
  } catch {
    return { status: 401 as const, body: "assinatura inválida" };
  }
  const existing = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: providerId, eventId: evt.eventId } } });
  if (existing?.processedAt) return { status: 200 as const, body: "duplicado" };
  const rec =
    existing ??
    (await db.webhookEvent
      .create({ data: { provider: providerId, eventId: evt.eventId, type: evt.type, payload: JSON.parse(rawBody) } })
      .catch(() => null));
  if (!rec) return { status: 200 as const, body: "duplicado" };
  try {
    const payment = await db.payment.findFirst({ where: { provider: providerId, providerRef: evt.providerRef } });
    if (payment && evt.status === "PAID") await creditPayment(payment.id, "system");
    if (payment && evt.status === "FAILED" && payment.status === "PENDING") await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
    await db.webhookEvent.update({ where: { id: rec.id }, data: { processedAt: new Date() } });
    return { status: 200 as const, body: "ok" };
  } catch (e) {
    await db.webhookEvent.update({ where: { id: rec.id }, data: { error: String(e).slice(0, 500) } });
    return { status: 500 as const, body: "erro" };
  }
}
