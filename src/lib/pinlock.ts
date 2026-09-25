/** Bloqueio por PIN: regras puras (testadas em tests/pinlock.test.ts). */

export const PIN_LOCK = {
  /** minutos parado até travar */
  options: [1, 5, 15, 30] as const,
  defaultMinutes: 5,
  /** erros seguidos até encerrar a sessão */
  maxFails: 5,
  /** intervalo mínimo entre registros de atividade */
  touchEverySec: 20,
};

export function pinError(pin: unknown): string | null {
  const p = String(pin ?? "");
  if (!/^\d{4,6}$/.test(p)) return "O PIN precisa ter de 4 a 6 números";
  if (/^(\d)\1+$/.test(p)) return "Não use o mesmo número repetido";
  const up = "0123456789", down = "9876543210";
  if (up.includes(p) || down.includes(p)) return "Não use uma sequência (1234, 4321…)";
  return null;
}

export function lockMinutes(v: unknown) {
  const n = Number(v);
  return (PIN_LOCK.options as readonly number[]).includes(n) ? n : PIN_LOCK.defaultMinutes;
}

/** Sessão travada: travada à mão, ou parada há mais que o tempo escolhido. */
export function isLocked(
  u: { pinHash: string | null; pinLockMinutes: number },
  s: { lockedAt: Date | null; lastActiveAt: Date | null },
  now = Date.now(),
) {
  if (!u.pinHash) return false;
  if (s.lockedAt) return true;
  return !!s.lastActiveAt && now - s.lastActiveAt.getTime() > u.pinLockMinutes * 60_000;
}

/** Só caminhos internos depois de desbloquear. */
export function safeNext(raw: unknown) {
  const p = String(raw ?? "").slice(0, 300);
  // tab/quebra de linha somem no navegador ("/\t/x.com" vira "//x.com"): recusa qualquer caractere de controle
  if (!p.startsWith("/") || /[\u0000-\u0020\u007f\\]/.test(p) || p.startsWith("/desbloquear")) return "/feed";
  try {
    const u = new URL(p, "http://base.invalid");
    return u.origin === "http://base.invalid" ? u.pathname + u.search : "/feed";
  } catch {
    return "/feed";
  }
}
