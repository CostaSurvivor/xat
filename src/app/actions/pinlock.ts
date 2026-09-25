"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { hasPassword } from "@/lib/oauth";
import { PIN_LOCK, lockMinutes, pinError, safeNext } from "@/lib/pinlock";
import { destroySession, hashPassword, loadSession, logAccess, requireUser, touchActivity, verifyPassword } from "@/server/auth";

export type PinState = { ok?: boolean; error?: string; msg?: string } | undefined;

/** Confere a senha da conta antes de mexer no PIN (quem pegou o celular aberto não troca nem tira o PIN). */
async function checkPassword(user: { id: string; passwordHash: string }, fd: FormData) {
  if (!hasPassword(user)) return "Defina uma senha para a conta antes (logo abaixo, em “Definir senha”).";
  if (!limiter("pin-config", 8, 8 / 900).take(user.id)) return "Muitas tentativas. Aguarde alguns minutos.";
  return (await verifyPassword(user.passwordHash, String(fd.get("password") ?? ""))) ? null : "Senha da conta incorreta";
}

export async function setPin(_: PinState, fd: FormData): Promise<PinState> {
  const user = await requireUser();
  const bad = await checkPassword(user, fd);
  if (bad) return { ok: false, error: bad };
  const pin = String(fd.get("pin") ?? "");
  const err = pinError(pin);
  if (err) return { ok: false, error: err };
  if (pin !== String(fd.get("pin2") ?? "")) return { ok: false, error: "Os dois PINs não conferem" };
  await db.user.update({ where: { id: user.id }, data: { pinHash: await hashPassword(pin), pinLockMinutes: lockMinutes(fd.get("minutes")) } });
  const st = await loadSession();
  if (st) await db.session.update({ where: { id: st.session.id }, data: { lastActiveAt: new Date(), lockedAt: null, pinFails: 0 } });
  // os outros aparelhos logados passam a pedir o PIN na hora
  await db.session.updateMany({ where: { userId: user.id, ...(st ? { NOT: { id: st.session.id } } : {}) }, data: { lockedAt: new Date() } });
  await logAccess(user.id, "pin.set");
  return { ok: true, msg: "PIN ativado 🔒" };
}

export async function removePin(_: PinState, fd: FormData): Promise<PinState> {
  const user = await requireUser();
  const bad = await checkPassword(user, fd);
  if (bad) return { ok: false, error: bad };
  await db.user.update({ where: { id: user.id }, data: { pinHash: null } });
  await db.session.updateMany({ where: { userId: user.id }, data: { lockedAt: null, pinFails: 0 } });
  await logAccess(user.id, "pin.remove");
  return { ok: true, msg: "PIN desativado" };
}

/** Travar agora (botão ou o site parado no aparelho). */
export async function lockNow() {
  const st = await loadSession();
  if (st?.user.pinHash && !st.locked) await db.session.update({ where: { id: st.session.id }, data: { lockedAt: new Date() } });
}

/** Toque/tecla na tela: conta como atividade (a cada 20 s no máximo). */
export async function pingActivity() {
  await touchActivity();
}

export async function lockStatus() {
  return !!(await loadSession())?.locked;
}

export async function unlock(_: PinState, fd: FormData): Promise<PinState> {
  const st = await loadSession();
  if (!st) redirect("/login");
  const next = safeNext(fd.get("next"));
  if (!st.locked) redirect(next);
  if (!limiter("pin-unlock", 10, 10 / 300).take(st.session.id)) return { ok: false, error: "Muitas tentativas. Aguarde um pouco." };
  // reserva a tentativa ANTES de conferir: pedidos em paralelo não passam do limite
  const reserved = await db.session.updateMany({ where: { id: st.session.id, pinFails: { lt: PIN_LOCK.maxFails } }, data: { pinFails: { increment: 1 } } });
  const out = async () => {
    await logAccess(st.user.id, "pin.logout");
    await destroySession();
    redirect("/login?erro=pin");
  };
  if (!reserved.count) return out();
  const ok = !!st.user.pinHash && (await verifyPassword(st.user.pinHash, String(fd.get("pin") ?? "")));
  if (!ok) {
    const fails = (await db.session.findUnique({ where: { id: st.session.id }, select: { pinFails: true } }))?.pinFails ?? PIN_LOCK.maxFails;
    if (fails >= PIN_LOCK.maxFails) return out();
    const left = PIN_LOCK.maxFails - fails;
    return { ok: false, error: `PIN incorreto. ${left} ${left === 1 ? "tentativa" : "tentativas"} antes de sair da conta.` };
  }
  await db.session.update({ where: { id: st.session.id }, data: { lockedAt: null, pinFails: 0, lastActiveAt: new Date() } });
  redirect(next);
}

export async function forgotPin() {
  await destroySession();
  redirect("/login?erro=pin");
}
