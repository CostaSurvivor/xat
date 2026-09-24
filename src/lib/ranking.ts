/** Regras puras dos Destaques (testadas em tests/ranking.test.ts). */

export const PERIODS = { semana: 7, mes: 30 } as const;
export type Period = keyof typeof PERIODS;
export const periodOf = (v: string | undefined): Period => (v === "mes" ? "mes" : "semana");

/** Pontuação: cada reação de perfil verificado vale 1; cada pessoa que comentou vale 2. */
export function postScore(reactions: number, commenters: number) {
  return reactions + 2 * commenters;
}

/** Ordena por pontos; empate: o mais recente primeiro. */
export function rankItems<T extends { score: number; createdAt: Date | string }>(items: T[]) {
  return [...items].sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const PROFILE_GROUPS = {
  casais: { label: "Casais", types: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] },
  mulheres: { label: "Mulheres", types: ["SINGLE_WOMAN"] },
  homens: { label: "Homens", types: ["SINGLE_MAN"] },
  outros: { label: "Trans e outros", types: ["TRANS", "OTHER"] },
} as const;
export type ProfileGroup = keyof typeof PROFILE_GROUPS;
export const groupOf = (v: string | undefined): ProfileGroup => (v && v in PROFILE_GROUPS ? (v as ProfileGroup) : "casais");

export const MEDALS = ["🥇", "🥈", "🥉"];
