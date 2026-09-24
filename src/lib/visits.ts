/** Regras puras de "Quem visitou meu perfil" (testadas em tests/visits.test.ts). */

export const VISITS = {
  /** a mesma pessoa só conta de novo depois deste intervalo */
  recountAfterMs: 30 * 60_000,
  /** janela mostrada na página */
  windowDays: 30,
  /** guardado por no máximo */
  retentionDays: 90,
};

/** Visita que NÃO deixa rastro: a si mesmo, equipe do site (moderação discreta), poder Invisível, bloqueio. */
export function shouldRecordVisit(v: { viewerId: string; targetId: string; viewerRole: string; invisible: boolean; blocked: boolean }) {
  if (v.viewerId === v.targetId) return false;
  if (v.viewerRole !== "USER") return false;
  if (v.invisible || v.blocked) return false;
  return true;
}

/** Soma +1 só se a última visita da mesma pessoa foi há mais de 30 min. */
export function visitIncrement(lastAt: Date | null, now = Date.now()) {
  return !lastAt || now - lastAt.getTime() > VISITS.recountAfterMs ? 1 : 0;
}
