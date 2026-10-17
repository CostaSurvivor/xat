/** Rótulos e contas do perfil e da busca (puras; testadas em tests/profileInfo.test.ts). */
import { ageOn } from "@/lib/age";

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** "online agora", "visto há 5 min", "visto há 3 h", "visto ontem", "visto há 4 dias", "visto há mais de 1 mês" */
export function lastSeenLabel(at: Date | null, now = Date.now()) {
  if (!at) return null;
  const d = now - at.getTime();
  if (d < 5 * MIN) return "online agora";
  if (d < HOUR) return `visto há ${Math.floor(d / MIN)} min`;
  if (d < DAY) return `visto há ${Math.floor(d / HOUR)} h`;
  if (d < 2 * DAY) return "visto ontem";
  if (d < 30 * DAY) return `visto há ${Math.floor(d / DAY)} dias`;
  return "visto há mais de 1 mês";
}

/** "Membro desde hoje", "Membro há 3 meses", "Membro há 2 anos" */
export function memberSince(createdAt: Date, now = new Date()) {
  const months = (now.getUTCFullYear() - createdAt.getUTCFullYear()) * 12 + (now.getUTCMonth() - createdAt.getUTCMonth()) - (now.getUTCDate() < createdAt.getUTCDate() ? 1 : 0);
  if (months >= 12) {
    const y = Math.floor(months / 12);
    return `Membro há ${y} ${y === 1 ? "ano" : "anos"}`;
  }
  if (months >= 1) return `Membro há ${months} ${months === 1 ? "mês" : "meses"}`;
  const days = Math.floor((now.getTime() - createdAt.getTime()) / DAY);
  if (days < 1) return "Membro desde hoje";
  return `Membro há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** "Ele 34 Hétero · Ela 31 Bi" (pessoa sozinha: "34 · Bi") */
export function personsLine(persons: { label: string; birthDate: Date; orientation?: string | null }[], now = new Date()) {
  if (persons.length === 1) {
    const p = persons[0];
    return [`${ageOn(p.birthDate, now)} anos`, p.orientation].filter(Boolean).join(" · ");
  }
  return persons.map((p) => [p.label, ageOn(p.birthDate, now), p.orientation].filter(Boolean).join(" ")).join(" · ");
}

export const AGE_MIN = 18, AGE_MAX = 80;

/** Faixa de idade da busca (ignora valores inválidos; inverte se vierem trocados). */
export function parseAgeRange(minRaw: unknown, maxRaw: unknown) {
  const n = (v: unknown) => {
    const x = Number(v);
    return typeof v === "string" && v.trim() && Number.isInteger(x) && x >= AGE_MIN && x <= AGE_MAX ? x : null;
  };
  let min = n(minRaw), max = n(maxRaw);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  return { min, max };
}

/** Datas de nascimento que dão idade entre min e max hoje. */
export function birthBounds(min: number | null, max: number | null, now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  return {
    // idade <= max: nasceu depois de (hoje - (max+1) anos)
    gt: max != null ? new Date(Date.UTC(y - max - 1, m, d)) : undefined,
    // idade >= min: nasceu até (hoje - min anos)
    lte: min != null ? new Date(Date.UTC(y - min, m, d)) : undefined,
  };
}

export type CompletenessInput = {
  avatarId: string | null;
  bio: string | null;
  city: string | null;
  likes: unknown;
  ageVerification: string;
  persons: { orientation: string | null; body: string | null }[];
  posts: number;
};

/** Perfil completo em %: cada item vale o mesmo. Devolve também o próximo passo (com link). */
export function completeness(u: CompletenessInput) {
  const items = [
    { done: !!u.avatarId, label: "Coloque uma foto de perfil", href: "/perfil" },
    { done: u.ageVerification === "APPROVED", label: "Verifique seu perfil com uma selfie", href: "/verificacao" },
    { done: (u.bio?.trim().length ?? 0) >= 20, label: "Escreva uma apresentação (20+ letras)", href: "/perfil" },
    { done: !!u.city, label: "Informe sua cidade", href: "/perfil" },
    { done: Array.isArray(u.likes) && u.likes.length >= 3, label: "Marque pelo menos 3 coisas que curte", href: "/perfil" },
    { done: u.persons.length > 0 && u.persons.every((p) => p.orientation && p.body), label: "Preencha orientação e corpo", href: "/perfil" },
    { done: u.posts > 0, label: "Faça sua primeira publicação", href: "/feed" },
  ];
  const done = items.filter((i) => i.done).length;
  return { pct: Math.round((done / items.length) * 100), next: items.find((i) => !i.done) ?? null, missing: items.filter((i) => !i.done).length };
}
