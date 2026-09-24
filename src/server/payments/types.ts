/**
 * Camada de pagamentos plugável. Hoje: Pix manual (aprovação no admin).
 * Para ligar um gateway (ex.: Segpay, CCBill ou um PSP de Pix que aceite o nicho),
 * implemente PaymentProvider e registre em ./index.ts — o resto (ledger,
 * idempotência, assinatura, recibo) já está pronto.
 */
export type ChargeInput = {
  paymentId: string;
  code: string;
  amountCents: number;
  description: string;
  customer: { id: string; email: string; nick: string };
};

export type ChargeResult =
  | { kind: "pix_static"; payload: string } // copia-e-cola gerado localmente
  | { kind: "pix_dynamic"; payload: string; providerRef: string; expiresAt?: Date }
  | { kind: "redirect"; url: string; providerRef: string };

/** Evento já validado (assinatura conferida) e normalizado. */
export type WebhookResult = {
  eventId: string;
  type: string;
  providerRef: string;
  status: "PAID" | "FAILED" | "REFUNDED" | "PENDING";
};

export interface PaymentProvider {
  id: string;
  label: string;
  /** Cria a cobrança. */
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /** Valida a assinatura e normaliza o webhook. Deve lançar erro se for inválido. */
  parseWebhook?(req: { headers: Headers; rawBody: string }): Promise<WebhookResult>;
}
