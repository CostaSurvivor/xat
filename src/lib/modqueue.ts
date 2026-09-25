/** Fila única de moderação: regras puras (testadas em tests/modqueue.test.ts). */

export type QueueKind = "report" | "verification" | "event" | "place";

/** Prioridade base de cada tipo; denúncia usa a própria prioridade (possível menor = 100). */
export const KIND_PRIORITY: Record<QueueKind, number> = { report: 0, verification: 40, event: 30, place: 20 };

export function queueOrder<T extends { kind: QueueKind; priority: number; createdAt: string }>(items: T[]) {
  const p = (i: T) => (i.kind === "report" ? i.priority : KIND_PRIORITY[i.kind]);
  return [...items].sort((a, b) => p(b) - p(a) || a.createdAt.localeCompare(b.createdAt));
}

/** Atalhos de teclado por tipo. Escalar (crime) nunca tem atalho: só pelo botão. */
export const SHORTCUTS: Record<QueueKind, Record<string, { op: string; label: string; danger?: boolean }>> = {
  verification: { a: { op: "approve", label: "Aprovar" }, r: { op: "reject", label: "Recusar" } },
  event: { a: { op: "approve", label: "Aprovar" }, r: { op: "reject", label: "Recusar" } },
  place: { a: { op: "approve", label: "Aprovar" }, r: { op: "reject", label: "Recusar" } },
  report: {
    i: { op: "dismiss", label: "Improcedente" },
    d: { op: "remove", label: "Remover conteúdo" },
    s: { op: "remove_suspend", label: "Remover + suspender 7d", danger: true },
    b: { op: "remove_ban", label: "Remover + banir", danger: true },
  },
};

export function opAllowed(kind: QueueKind, op: string) {
  if (kind === "report" && op === "escalate") return true;
  return Object.values(SHORTCUTS[kind]).some((s) => s.op === op);
}

export const REJECT_REASONS = [
  "Gesto diferente do pedido",
  "Nick não aparece no papel",
  "Rosto não visível",
  "Falta uma pessoa do casal",
  "Foto parece não ser real / da internet",
  "Não foi possível confirmar maioridade",
];
