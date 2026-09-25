/** "🔥 Afim hoje": regras puras (testadas em tests/afim.test.ts). */
import { forbiddenReason } from "@/lib/contos";

export const AFIM = {
  /** por quantas horas o status fica no ar */
  hours: [2, 4, 8, 12] as const,
  defaultHours: 4,
  noteMax: 120,
  /** quantas vezes por dia dá para ligar (evita ficar "subindo" o tempo todo) */
  perDay: 4,
} as const;

/** Sugestões rápidas de recado (a pessoa pode escrever o seu). */
export const AFIM_SUGGESTIONS = [
  "Afim de sair hoje à noite",
  "Procurando casal para hoje",
  "Topa um drink e ver no que dá?",
  "Na balada, quem vem?",
  "Recebo em casa hoje",
] as const;

// recado não é classificado: nada de telefone, dinheiro ou programa
const PHONE = /(\d[\s().-]*){8,}/;
const PAID = /(?<![\p{L}\d])(programa|cach[eê]|pix|valor(es)?|pago|cobro|acompanhante)(?![\p{L}\d])|r\$/iu;
const LINKS = /(https?:\/\/|www\.|\.com\b|@\w+\.\w+|wa\.me|whats(app)?|telegram|insta(gram)?)/i;

/** Valida o pedido de ligar o status. Devolve até quando vale e o recado limpo, ou o erro. */
export function parseAfim(raw: { hours: unknown; note: unknown }, now = Date.now()): { until: Date; note: string | null } | { error: string } {
  const h = Number(raw.hours);
  if (!AFIM.hours.includes(h as (typeof AFIM.hours)[number])) return { error: "Escolha por quanto tempo." };
  const note = String(raw.note ?? "").replace(/\s+/g, " ").trim();
  if (note.length > AFIM.noteMax) return { error: `O recado pode ter até ${AFIM.noteMax} letras.` };
  if (PHONE.test(note) || LINKS.test(note)) return { error: "Sem telefone, links ou redes no recado: combinem pelo PV." };
  if (PAID.test(note)) return { error: "Anúncios de programa ou pagamento não são permitidos." };
  const why = forbiddenReason(note);
  if (why) return { error: `Recados com ${why} não são permitidos.` };
  return { until: new Date(now + h * 3600_000), note: note || null };
}

/** Está afim agora? */
export function isAfim(u: { afimUntil: Date | null }, now = Date.now()) {
  return !!u.afimUntil && u.afimUntil.getTime() > now;
}

/** "até 23h" (horário de Brasília). */
export function afimUntilLabel(until: Date) {
  const h = new Date(until.getTime() - 3 * 3600_000);
  const hh = h.getUTCHours();
  const mm = h.getUTCMinutes();
  return `até ${hh}h${mm ? String(mm).padStart(2, "0") : ""}`;
}
