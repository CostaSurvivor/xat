/** Paquera: regras puras (testadas em tests/paquera.test.ts). */

export const PAQUERA = {
  /** curtidas por dia (anti-robô) */
  likesPerDay: 150,
  /** quem foi "passado" volta a aparecer depois destes dias */
  skipDays: 30,
};

type Who = { id: string; ageVerification: string; status?: string };

/** Só perfis verificados curtem e são curtidos; nunca a si mesmo nem com bloqueio. */
export function likeError(me: Who, target: Who, blocked: boolean, likesToday: number) {
  if (me.id === target.id) return "Você não pode curtir a si mesmo.";
  if (me.ageVerification !== "APPROVED") return "Verifique seu perfil para usar a Paquera.";
  if (target.ageVerification !== "APPROVED" || (target.status && target.status !== "ACTIVE") || blocked) return "Perfil indisponível.";
  if (likesToday >= PAQUERA.likesPerDay) return "Você chegou ao limite de curtidas de hoje. Volte amanhã! 💘";
  return null;
}

/** Match = as duas pessoas se curtiram. */
export const isMatch = (iLike: boolean, likesMe: boolean) => iLike && likesMe;

/** Ordem dos candidatos: mesmo estado primeiro, depois quem entrou mais recentemente. */
export function candidateOrder<T extends { state: string | null; lastSeenAt: Date | null }>(list: T[], myState: string | null) {
  return [...list].sort((a, b) => Number(b.state === myState) - Number(a.state === myState) || (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0));
}
