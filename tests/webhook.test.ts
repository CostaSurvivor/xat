/** Webhook de gateway: assinatura, idempotência e crédito único (usa o banco do .env). */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d("webhook de pagamento", async () => {
  vi.stubEnv("GATEWAY_WEBHOOK_SECRET", "segredo-teste");
  const db = new PrismaClient();
  const { handleWebhook } = await import("@/server/payments");
  const { balanceOf } = await import("@/server/ledger");
  const tag = randomBytes(4).toString("hex");
  let userId = "";
  let paymentId = "";

  const sign = (body: string, secret = "segredo-teste") => new Headers({ "x-signature": createHmac("sha256", secret).update(body).digest("hex") });
  const body = (eventId: string, status = "paid") => JSON.stringify({ id: eventId, type: "charge.updated", data: { charge_id: `ch_${tag}`, status } });

  beforeAll(async () => {
    const u = await db.user.create({ data: { email: `wh-${tag}@t.local`, passwordHash: "x", nick: `wh${tag}`, birthDate: new Date("1990-01-01"), profileType: "SINGLE_MAN" } });
    userId = u.id;
    const p = await db.payment.create({ data: { userId, provider: "example", providerRef: `ch_${tag}`, code: `W${tag}`.slice(0, 12), amountCents: 990, coins: 100, packageName: "t" } });
    paymentId = p.id;
  });
  afterAll(async () => {
    const w = await db.wallet.findUnique({ where: { userId } });
    if (w) {
      const txs = (await db.ledgerEntry.findMany({ where: { walletId: w.id } })).map((e) => e.transactionId);
      await db.ledgerEntry.deleteMany({ where: { transactionId: { in: txs } } });
      await db.ledgerTransaction.deleteMany({ where: { id: { in: txs } } });
      await db.wallet.delete({ where: { id: w.id } });
    }
    await db.webhookEvent.deleteMany({ where: { provider: "example", eventId: { startsWith: `ev_${tag}` } } });
    await db.payment.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("recusa assinatura inválida", async () => {
    const b = body(`ev_${tag}_x`);
    const r = await handleWebhook("example", sign(b, "outro-segredo"), b);
    expect(r.status).toBe(401);
    expect(await balanceOf(userId)).toBe(0);
  });

  it("credita uma única vez com reentregas e eventos diferentes", async () => {
    const b1 = body(`ev_${tag}_1`);
    const b2 = body(`ev_${tag}_2`);
    const results = await Promise.all([handleWebhook("example", sign(b1), b1), handleWebhook("example", sign(b1), b1), handleWebhook("example", sign(b2), b2)]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await balanceOf(userId)).toBe(100);
    expect((await db.payment.findUnique({ where: { id: paymentId } }))!.status).toBe("PAID");
  });

  it("provider desconhecido = 404", async () => {
    expect((await handleWebhook("nao-existe", new Headers(), "{}")).status).toBe(404);
  });
});
