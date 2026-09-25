/** Promoção de lançamento: os primeiros cadastros ganham Pimentas + VIP (testada em tests/welcome.test.ts). */

export const WELCOME = {
  /** quantos cadastros ganham */
  slots: 25,
  coins: 500,
  vipDays: 7,
};

/**
 * Valor em reais das Pimentas do bônus, pelo preço do pacote base (o menor, sem bônus).
 * Ex.: 100 🌶️ por R$ 9,90 → 500 🌶️ ≈ R$ 49,50.
 */
export function coinsValueCents(coins: number, packages: { coins: number; bonusCoins: number; priceCents: number; active?: boolean }[]) {
  const base = packages.filter((p) => p.active !== false && p.coins > 0).sort((a, b) => a.coins - b.coins)[0];
  if (!base) return null;
  return Math.round((coins * base.priceCents) / base.coins);
}

export function slotsLeft(used: number) {
  return Math.max(0, WELCOME.slots - used);
}
