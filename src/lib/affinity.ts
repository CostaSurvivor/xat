/** Afinidade entre perfis pelos "o que curtimos" (testada em tests/affinity.test.ts). */
import { LIKE_TAGS } from "@/lib/config";

/** Mínimo de itens marcados, de cada lado, para calcular. */
export const AFFINITY_MIN_TAGS = 2;

export function tagsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((t): t is string => typeof t === "string" && LIKE_TAGS.includes(t)))];
}

/**
 * Coeficiente de Dice (2·comuns / (A + B)), em % arredondada de 5 em 5.
 * null quando alguém marcou poucos itens (não dá para dizer).
 */
export function affinity(a: unknown, b: unknown): { pct: number; common: string[] } | null {
  const A = tagsOf(a), B = new Set(tagsOf(b));
  if (A.length < AFFINITY_MIN_TAGS || B.size < AFFINITY_MIN_TAGS) return null;
  const common = A.filter((t) => B.has(t));
  const pct = Math.round(((2 * common.length) / (A.length + B.size)) * 20) * 5;
  return { pct, common };
}

export function affinityTier(pct: number) {
  if (pct >= 70) return { label: "Afinidade alta", cls: "bg-wine text-white" };
  if (pct >= 40) return { label: "Boa afinidade", cls: "bg-pink-100 text-wine" };
  return { label: "Pouca afinidade", cls: "bg-black/5 text-mute" };
}
