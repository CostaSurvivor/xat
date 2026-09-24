import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * MODELO de integração com gateway (não está ativo). Mostra o contrato:
 * cobrança via API do gateway + webhook assinado com HMAC-SHA256.
 * Copie este arquivo para o gateway escolhido, troque URL/campos e
 * registre em ./index.ts. Ativação: PAYMENT_PROVIDER=<id>.
 */
export const exampleGateway: PaymentProvider = {
  id: "example",
  label: "Gateway de exemplo",
  async createCharge(input) {
    const res = await fetch(`${process.env.GATEWAY_API_URL}/charges`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountCents, currency: "BRL", method: "pix", reference: input.code, description: input.description }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const j = (await res.json()) as { id: string; pix_copy_paste: string; expires_at?: string };
    return { kind: "pix_dynamic", payload: j.pix_copy_paste, providerRef: j.id, expiresAt: j.expires_at ? new Date(j.expires_at) : undefined };
  },
  async parseWebhook({ headers, rawBody }) {
    const secret = process.env.GATEWAY_WEBHOOK_SECRET || "";
    const sig = headers.get("x-signature") || "";
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("assinatura inválida");
    const e = JSON.parse(rawBody) as { id: string; type: string; data: { charge_id: string; status: string } };
    const status = e.data.status === "paid" ? "PAID" : e.data.status === "refunded" ? "REFUNDED" : e.data.status === "failed" ? "FAILED" : "PENDING";
    return { eventId: e.id, type: e.type, providerRef: e.data.charge_id, status };
  },
};
