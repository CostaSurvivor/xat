"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { isVerified, requireUser, verifyPassword } from "@/server/auth";
import { notify } from "@/server/notify";
import { TradeError, acceptTrade, cancelTrade, createTrade, setOffer } from "@/server/trades";

type R = { ok: boolean; error?: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof TradeError ? e.message : "Erro inesperado" });

export async function startTrade(nick: string) {
  const user = await requireUser();
  if (!isVerified(user)) redirect("/verificacao");
  const other = await db.user.findFirst({ where: { nick: nick.replace(/^@/, "").trim(), status: "ACTIVE" } });
  if (!other) redirect("/trocas?erro=nick");
  if (!isVerified(other)) redirect("/trocas?erro=verif");
  let id: string;
  try {
    const t = await createTrade(user.id, other.id);
    id = t.id;
    if (t.aId === user.id && t.version === 1) await notify(other.id, "TRADE", `🔄 @${user.nick} quer fazer uma troca com você`, user.id, t.id);
  } catch (e) {
    redirect(`/trocas?erro=${encodeURIComponent(e instanceof TradeError ? e.message : "erro")}`);
  }
  redirect(`/trocas/${id}`);
}

export async function saveOffer(tradeId: string, offer: { coins: number; vipDays: number; itemIds: string[] }): Promise<R> {
  const user = await requireUser();
  if (!limiter("trade-offer", 30, 1).take(user.id)) return { ok: false, error: "Devagar!" };
  try {
    await setOffer(tradeId, user.id, offer);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function acceptTradeAction(tradeId: string, version: number): Promise<R> {
  const user = await requireUser();
  try {
    await acceptTrade(tradeId, user.id, version, "accept");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Confirmação final exige a senha da conta (como no xat). */
export async function confirmTradeAction(tradeId: string, version: number, password: string): Promise<R> {
  const user = await requireUser();
  if (!limiter("trade-confirm", 6, 6 / 300).take(user.id)) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  if (!(await verifyPassword(user.passwordHash, password))) return { ok: false, error: "Senha incorreta" };
  try {
    const t = await acceptTrade(tradeId, user.id, version, "confirm");
    if (t.status === "COMPLETED") {
      const other = t.aId === user.id ? t.bId : t.aId;
      await notify(other, "TRADE", `✅ Troca com @${user.nick} concluída!`, user.id, t.id);
      await notify(user.id, "TRADE", "✅ Troca concluída! Confira seus itens e Pimentas.", other, t.id);
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTradeAction(tradeId: string): Promise<R> {
  const user = await requireUser();
  const t = await cancelTrade(tradeId, user.id);
  if (t) await notify(t.aId === user.id ? t.bId : t.aId, "TRADE", `❌ @${user.nick} cancelou a troca`, user.id, t.id);
  return { ok: true };
}
