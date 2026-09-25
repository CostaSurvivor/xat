/** Contos eróticos: regras puras (testadas em tests/contos.test.ts). */

export const CONTOS = {
  titleMin: 4,
  titleMax: 120,
  bodyMin: 300,
  bodyMax: 20000,
  /** contos novos por pessoa em 24 h */
  perDay: 3,
  pageSize: 20,
  commentMax: 1000,
  /** comentários mostrados por conto */
  commentsShown: 200,
  /** palavras por minuto para o "tempo de leitura" */
  wpm: 200,
};

export const CONTO_CATEGORIES = {
  real: { label: "Aconteceu comigo", emoji: "✨" },
  fantasia: { label: "Fantasia", emoji: "💭" },
  casais: { label: "Casais", emoji: "💑" },
  swing: { label: "Swing e troca", emoji: "🔄" },
  menage: { label: "Ménage", emoji: "🔥" },
  cuckold: { label: "Cuckold / hotwife", emoji: "👀" },
  gay: { label: "Gay", emoji: "🌈" },
  lesbico: { label: "Lésbico", emoji: "💋" },
  bi: { label: "Bi", emoji: "💜" },
  fetiche: { label: "Fetiche", emoji: "⛓️" },
  "primeira-vez": { label: "Primeira vez no meio", emoji: "🌶️" },
} as const;
export type ContoCategory = keyof typeof CONTO_CATEGORIES;

export function isCategory(c: unknown): c is ContoCategory {
  return typeof c === "string" && Object.hasOwn(CONTO_CATEGORIES, c);
}

/**
 * Conteúdo proibido em qualquer conto, mesmo ficção: menores, sem consentimento, incesto e zoofilia.
 * A equipe ainda revisa denúncias; isto só barra o óbvio na hora de publicar.
 */
const FORBIDDEN: [RegExp, string][] = [
  [/\b(menor(es)? de idade|crian[çc]as?|adolescentes?|pr[ée]-?adolescentes?|colegiais?|ensino (fundamental|m[ée]dio)|novinhas?|ninfetas?|lolitas?|pedofil\w*)\b/i, "menores de idade"],
  [/\b(estupr\w*|dopad[ao]s?|desacordad[ao]s?|sem (o )?consentimento|for[çc]ad[ao] a transar)\b/i, "sexo sem consentimento"],
  [/\b(incesto|incestuos[ao]s?)\b/i, "incesto"],
  [/\b(zoofilia|bestialidade)\b/i, "zoofilia"],
];

/** Idades abaixo de 18 ditas no texto ("tinha 16 anos", "uma de 15 anos", "aos 15"); "15 anos de casados" não conta. */
const AGE_PATTERNS = [
  /\b(?:tinha|tinham|com|de|idade de)\s+(\d{1,2})\s*anos\b(?!\s+(?:de\s+)?(?:casad|casament|namor|relaciona|uni|experi|juntos|meio|swing|carreira|empresa))/gi,
  /\baos\s+(\d{1,2})(?:\s*anos)?\b/gi,
  /\b(\d{1,2})\s*(?:aninhos|anos de idade)\b/gi,
];
function minorAge(text: string) {
  for (const re of AGE_PATTERNS)
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (n > 0 && n < 18) return true;
    }
  return false;
}

export function forbiddenReason(text: string): string | null {
  for (const [re, why] of FORBIDDEN) if (re.test(text)) return why;
  if (minorAge(text)) return "menores de idade";
  return null;
}

type Input = { title: unknown; category: unknown; body: unknown };

/** Valida e limpa o conto. Devolve os campos prontos ou a mensagem de erro. */
export function parseConto(raw: Input): { title: string; category: ContoCategory; body: string } | { error: string } {
  const title = String(raw.title ?? "").replace(/\s+/g, " ").trim();
  const body = String(raw.body ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (title.length < CONTOS.titleMin) return { error: `O título precisa de pelo menos ${CONTOS.titleMin} letras` };
  if (title.length > CONTOS.titleMax) return { error: `O título pode ter até ${CONTOS.titleMax} caracteres` };
  if (!isCategory(raw.category)) return { error: "Escolha uma categoria" };
  if (body.length < CONTOS.bodyMin) return { error: `O conto precisa de pelo menos ${CONTOS.bodyMin} caracteres (tem ${body.length})` };
  if (body.length > CONTOS.bodyMax) return { error: `O conto pode ter até ${CONTOS.bodyMax.toLocaleString("pt-BR")} caracteres` };
  if (/https?:\/\/|www\.|\b[\w.-]+\.(com|net|org)(\.br)?\b/i.test(`${title}\n${body}`)) return { error: "Links não são permitidos nos contos" };
  const why = forbiddenReason(`${title}\n${body}`);
  if (why) return { error: `Contos com ${why} não são permitidos, nem como ficção. Revise o texto.` };
  return { title, category: raw.category, body };
}

export function publishError(user: { ageVerification: string }, lastDay: number) {
  if (user.ageVerification !== "APPROVED") return "Verifique seu perfil para publicar contos.";
  if (lastDay >= CONTOS.perDay) return `Você já publicou ${CONTOS.perDay} contos hoje. Volte amanhã.`;
  return null;
}

export function readingMinutes(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / CONTOS.wpm));
}

/** Prévia para a lista: primeiras linhas, cortada numa palavra. */
export function excerpt(body: string, max = 180) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s.,;:!?…-]+$/, "")}…`;
}

/** Quem edita: só o autor; quem apaga: o autor ou a equipe. */
export function canEditConto(c: { authorId: string; deletedAt: Date | null }, v: { id: string }) {
  return !c.deletedAt && c.authorId === v.id;
}
export function canDeleteConto(c: { authorId: string; deletedAt: Date | null }, v: { id: string; role: string }) {
  return !c.deletedAt && (c.authorId === v.id || v.role === "ADMIN" || v.role === "MODERATOR");
}

/** Comentário: 1 a 1000 caracteres, sem links nem conteúdo proibido. */
export function parseComment(raw: unknown): { body: string } | { error: string } {
  const body = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { error: "Escreva o comentário" };
  if (body.length > CONTOS.commentMax) return { error: `O comentário pode ter até ${CONTOS.commentMax} caracteres` };
  if (/https?:\/\/|www\./i.test(body)) return { error: "Links não são permitidos" };
  const why = forbiddenReason(body);
  if (why) return { error: `Comentários com ${why} não são permitidos.` };
  return { body };
}

/** Apaga um comentário: quem escreveu, o autor do conto ou a equipe. */
export function canDeleteComment(c: { authorId: string; deletedAt: Date | null }, conto: { authorId: string }, v: { id: string; role: string }) {
  return !c.deletedAt && (c.authorId === v.id || conto.authorId === v.id || v.role === "ADMIN" || v.role === "MODERATOR");
}
