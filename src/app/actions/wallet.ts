"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PIX } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { isVerified, requireUser } from "@/server/auth";

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "P" + Array.from({ length: 7 }, () => ALPH[randomInt(ALPH.length)]).join("");

/** Cria um pedido de recarga via Pix manual (chave estática do dono). */
export async function createPixPayment(packageId: string) {
  const user = await requireUser();
  if (!isVerified(user)) redirect("/verificacao");
  if (!PIX.key) redirect("/carteira?erro=pix");
  if (!limiter("pix-create", 5, 5 / 3600).take(user.id)) redirect("/carteira?erro=limite");
  const pkg = await db.coinPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) redirect("/carteira");
  // reaproveita pedido pendente igual, para não acumular lixo
  const open = await db.payment.findFirst({ where: { userId: user.id, status: "PENDING", packageName: pkg.name } });
  const p =
    open ??
    (await db.payment.create({
      data: { userId: user.id, code: newCode(), amountCents: pkg.priceCents, coins: pkg.coins + pkg.bonusCoins, packageName: pkg.name },
    }));
  redirect(`/carteira/pix/${p.id}`);
}

export async function claimPayment(paymentId: string, formData: FormData) {
  const user = await requireUser();
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.userId !== user.id || p.status !== "PENDING") return;
  const payerName = String(formData.get("payerName") || "").trim().slice(0, 120) || null;
  await db.payment.update({ where: { id: p.id }, data: { status: "CLAIMED", payerName } });
  revalidatePath(`/carteira/pix/${p.id}`);
}

export async function cancelPayment(paymentId: string) {
  const user = await requireUser();
  await db.payment.updateMany({ where: { id: paymentId, userId: user.id, status: "PENDING" }, data: { status: "EXPIRED" } });
  redirect("/carteira");
}

/** Pedido de assinatura via Pix manual. Admin aprova -> vipUntil estendido + bônus. */
export async function createVipPayment(planId: string) {
  const user = await requireUser();
  if (!isVerified(user)) redirect("/verificacao");
  if (!PIX.key) redirect("/assinar?erro=pix");
  if (!limiter("pix-create", 5, 5 / 3600).take(user.id)) redirect("/assinar?erro=limite");
  const plan = await db.vipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) redirect("/assinar");
  const open = await db.payment.findFirst({ where: { userId: user.id, status: "PENDING", kind: "VIP", packageName: plan.name } });
  const p =
    open ??
    (await db.payment.create({
      data: { userId: user.id, kind: "VIP", vipDays: plan.days, code: newCode(), amountCents: plan.priceCents, coins: plan.bonusCoins, packageName: plan.name },
    }));
  redirect(`/carteira/pix/${p.id}`);
}
