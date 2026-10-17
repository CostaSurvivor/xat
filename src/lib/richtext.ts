/** #hashtags e @menções no texto dos posts (puros; testados em tests/richtext.test.ts). */

export type Segment = { t: "text"; v: string } | { t: "tag"; v: string } | { t: "mention"; v: string };

// # ou @ só contam no começo ou depois de espaço/pontuação (não pega e-mail nem "C#")
const TOKEN = /(^|[\s(,.;:!?"'])([#@])([\p{L}\p{N}_.]{2,30})/gu;

export function normalizeTag(raw: string) {
  const t = raw.replace(/^#/, "").normalize("NFC").toLowerCase();
  return /^[\p{L}\p{N}_]{2,30}$/u.test(t) ? t : null;
}

export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const [, pre, sigil, word0] = m;
    const word = word0.replace(/[._]+$/, ""); // ponto final não faz parte
    if (word.length < 2) continue;
    const start = m.index! + pre.length;
    if (start > last) out.push({ t: "text", v: text.slice(last, start) });
    out.push(sigil === "#" ? { t: "tag", v: word.replace(/\./g, "") } : { t: "mention", v: word });
    last = start + 1 + word.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** O texto usa esta hashtag (palavra inteira)? */
export function hasTag(text: string | null, tag: string) {
  if (!text) return false;
  return segments(text).some((s) => s.t === "tag" && s.v.toLowerCase() === tag);
}

/** Resumo das reações: as 3 mais usadas + total ("🔥❤️😈 12"). */
export function reactionSummary(counts: Record<string, number>) {
  const list = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return { top: list.slice(0, 3).map(([e]) => e), total: list.reduce((s, [, n]) => s + n, 0) };
}
