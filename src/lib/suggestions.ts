/** "Sugestões para você": pontuação pura (testada em tests/suggestions.test.ts). */
import { affinity } from "@/lib/affinity";

export type SuggestionCandidate = { id: string; state: string | null; likes: unknown; avatarId: string | null; ageVerification: string; lastSeenAt: Date | null; createdAt: Date };
export type SuggestionViewer = { state: string | null; likes: unknown };

/** Quanto mais alto, mais no começo da faixa. */
export function suggestionScore(v: SuggestionViewer, c: SuggestionCandidate, now = Date.now()) {
  let s = 0;
  if (v.state && c.state === v.state) s += 3;
  const aff = affinity(v.likes, c.likes)?.pct ?? 0;
  s += aff / 25; // até +4
  if (c.avatarId) s += 1.5;
  if (c.ageVerification === "APPROVED") s += 1.5;
  if (c.lastSeenAt && now - c.lastSeenAt.getTime() < 3 * 86_400_000) s += 1;
  if (now - c.createdAt.getTime() < 14 * 86_400_000) s += 0.5; // gente nova
  return s;
}

export function pickSuggestions<T extends SuggestionCandidate>(v: SuggestionViewer, list: T[], take = 8, now = Date.now()) {
  return list
    .map((c) => ({ c, s: suggestionScore(v, c, now) }))
    .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id))
    .slice(0, take)
    .map((x) => x.c);
}
