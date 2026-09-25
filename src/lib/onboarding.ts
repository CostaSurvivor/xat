/** Primeiros passos: regras puras (testadas em tests/onboarding.test.ts). */

export const ONBOARDING_REWARD = 20;
export const rewardKey = (userId: string) => `onboarding:${userId}`;

export const STEPS = [
  { key: "verified", label: "Verificar o perfil com uma selfie", href: "/verificacao" },
  { key: "photo", label: "Colocar foto de perfil", href: "/perfil" },
  { key: "bio", label: "Escrever o “Sobre vocês”", href: "/perfil" },
  { key: "likes", label: "Marcar pelo menos 3 coisas que curtem", href: "/perfil" },
  { key: "room", label: "Entrar numa sala e dar um oi", href: "/salas" },
  { key: "post", label: "Fazer o primeiro post", href: "/feed" },
  { key: "push", label: "Ativar as notificações no celular", href: "/perfil#notificacoes-celular" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export type OnboardingFacts = { verified: boolean; hasAvatar: boolean; bio: string | null; likes: unknown; roomMessages: number; posts: number; pushDevices: number };

export function stepsDone(f: OnboardingFacts): Record<StepKey, boolean> {
  return {
    verified: f.verified,
    photo: f.hasAvatar,
    bio: (f.bio ?? "").trim().length >= 20,
    likes: Array.isArray(f.likes) && f.likes.length >= 3,
    room: f.roomMessages > 0,
    post: f.posts > 0,
    push: f.pushDevices > 0,
  };
}

export function progress(done: Record<StepKey, boolean>) {
  const n = STEPS.filter((s) => done[s.key]).length;
  return { done: n, total: STEPS.length, pct: Math.round((n / STEPS.length) * 100), complete: n === STEPS.length };
}
