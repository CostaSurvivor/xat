/** Conquistas: selos por usar o site (testadas em tests/achievements.test.ts). Não dão Pimentas. */

export type AchStats = {
  verified: boolean;
  posts: number;
  friends: number;
  followers: number;
  contos: number;
  invites: number;
  /** dias de presença diária pegos (no total) */
  streak: number;
  events: number;
  testimonials: number;
  ageDays: number;
};

type Def = { key: string; emoji: string; name: string; desc: string; value: (s: AchStats) => number; goal: number };

export const ACHIEVEMENTS: Def[] = [
  { key: "verificado", emoji: "✅", name: "Verificado", desc: "Perfil verificado com selfie", value: (s) => +s.verified, goal: 1 },
  { key: "primeiro-post", emoji: "📸", name: "Primeiro post", desc: "Publicou no feed", value: (s) => s.posts, goal: 1 },
  { key: "popular", emoji: "🌟", name: "Popular", desc: "25 seguidores", value: (s) => s.followers, goal: 25 },
  { key: "amigos", emoji: "🤝", name: "Bem relacionados", desc: "10 amigos", value: (s) => s.friends, goal: 10 },
  { key: "contista", emoji: "📖", name: "Contista", desc: "Publicou um conto", value: (s) => s.contos, goal: 1 },
  { key: "escritor", emoji: "✍️", name: "Escritor do meio", desc: "5 contos publicados", value: (s) => s.contos, goal: 5 },
  { key: "anfitriao", emoji: "📣", name: "Anfitrião", desc: "5 convites verificados", value: (s) => s.invites, goal: 5 },
  { key: "embaixador", emoji: "👑", name: "Embaixador", desc: "20 convites verificados", value: (s) => s.invites, goal: 20 },
  { key: "fiel", emoji: "🔥", name: "Fiel", desc: "7 dias de presença diária", value: (s) => s.streak, goal: 7 },
  { key: "festeiro", emoji: "🎉", name: "Festeiro", desc: "Confirmou presença em 3 eventos", value: (s) => s.events, goal: 3 },
  { key: "confiavel", emoji: "📝", name: "Recomendado", desc: "3 depoimentos aprovados", value: (s) => s.testimonials, goal: 3 },
  { key: "veterano", emoji: "🏅", name: "Veterano", desc: "1 ano de SexPapo", value: (s) => s.ageDays, goal: 365 },
];

export function evaluate(s: AchStats) {
  return ACHIEVEMENTS.map((a) => {
    const v = Math.max(0, a.value(s));
    return { key: a.key, emoji: a.emoji, name: a.name, desc: a.desc, goal: a.goal, progress: Math.min(v, a.goal), done: v >= a.goal };
  });
}

/** Próximas conquistas a mostrar: as mais perto de completar. */
export function nextGoals(list: ReturnType<typeof evaluate>, take = 3) {
  return list.filter((a) => !a.done).sort((a, b) => b.progress / b.goal - a.progress / a.goal).slice(0, take);
}
