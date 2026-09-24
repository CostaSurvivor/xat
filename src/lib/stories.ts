/** Regras puras dos Stories (testadas em tests/stories.test.ts). */

export const STORIES = {
  ttlHours: 24,
  /** stories no ar ao mesmo tempo por perfil */
  maxActive: 10,
  /** depois de expirar, a foto fica guardada só para a moderação por mais estes dias */
  keepDays: 7,
  /** segundos que cada foto fica na tela */
  seconds: 6,
  captionMax: 140,
};

type S = { authorId: string; audience: string; expiresAt: Date; deletedAt: Date | null };
type V = { id: string; role: string };

export function isActive(s: { expiresAt: Date; deletedAt: Date | null }, now = Date.now()) {
  return !s.deletedAt && s.expiresAt.getTime() > now;
}

/** Quem vê: o autor e a equipe sempre; os demais só enquanto está no ar, sem bloqueio, e amigos se o story for "só amigos". */
export function canSeeStory(s: S, v: V, rel: { friends: boolean; blocked: boolean }, now = Date.now()) {
  if (v.id === s.authorId || v.role !== "USER") return true;
  if (!isActive(s, now) || rel.blocked) return false;
  return s.audience !== "FRIENDS" || rel.friends;
}

/** Visualização que não deixa rastro: o próprio autor, a equipe e o poder Invisível. */
export function shouldRecordView(v: { viewerId: string; authorId: string; viewerRole: string; invisible: boolean }) {
  return v.viewerId !== v.authorId && v.viewerRole === "USER" && !v.invisible;
}

export function postError(user: { ageVerification: string }, activeCount: number) {
  if (user.ageVerification !== "APPROVED") return "Verifique seu perfil para postar stories.";
  if (activeCount >= STORIES.maxActive) return `Você já tem ${STORIES.maxActive} stories no ar. Espere algum expirar ou apague um.`;
  return null;
}

export function cleanCaption(raw: unknown) {
  const c = String(raw ?? "").trim().slice(0, STORIES.captionMax);
  if (/https?:\/\/|www\./i.test(c)) return { error: "Links não são permitidos" };
  return { caption: c || null };
}

/** Ordem da bandeja: eu primeiro, depois quem tem story não visto, depois o mais recente. */
export function trayOrder<T extends { authorId: string; unseen: boolean; latest: number }>(items: T[], meId: string) {
  return [...items].sort((a, b) => Number(b.authorId === meId) - Number(a.authorId === meId) || Number(b.unseen) - Number(a.unseen) || b.latest - a.latest);
}
