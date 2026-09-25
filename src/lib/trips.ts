/** Modo Viagem ("Estou viajando"): regras puras (testadas em tests/trips.test.ts). */
import { UFS } from "@/lib/config";

export const TRIPS = {
  /** viagens futuras/em andamento por pessoa */
  maxActive: 5,
  /** duração máxima de uma viagem */
  maxDays: 30,
  /** quão longe no futuro dá para anunciar */
  aheadDays: 180,
  /** "chegando" = começa nos próximos N dias */
  soonDays: 30,
  /** raio dos "visitantes perto de você" */
  radiusKm: 100,
  noteMax: 140,
};

const DAY = 86_400_000;

/** Data de hoje no horário de Brasília, como "AAAA-MM-DD". */
export function todayBR(now = Date.now()) {
  return new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" -> Date (meia-noite UTC, como o Prisma guarda @db.Date). */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => new Date(dateOnly(s).getTime() + n * DAY).toISOString().slice(0, 10);
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOnly(s).getTime()) && dateOnly(s).toISOString().startsWith(s);

type Raw = { city: unknown; state: unknown; from: unknown; to: unknown; note: unknown };

/**
 * Valida a viagem. `resolveCity` devolve o nome oficial da cidade na UF (ou null).
 * Datas em "AAAA-MM-DD"; `today` também.
 */
export function parseTrip(raw: Raw, today: string, resolveCity: (city: string, uf: string) => string | null) {
  const state = String(raw.state ?? "");
  if (!UFS.includes(state)) return { error: "Escolha o estado" } as const;
  const city = resolveCity(String(raw.city ?? "").trim(), state);
  if (!city) return { error: "Cidade não encontrada nesse estado. Escolha uma das sugestões." } as const;
  if (!isDate(raw.from) || !isDate(raw.to)) return { error: "Informe a data de ida e de volta" } as const;
  const from = raw.from, to = raw.to;
  if (to < today) return { error: "A volta já passou" } as const;
  if (to < from) return { error: "A volta precisa ser depois da ida" } as const;
  if (from > addDays(today, TRIPS.aheadDays)) return { error: `Dá para anunciar viagens até ${TRIPS.aheadDays} dias à frente` } as const;
  if ((dateOnly(to).getTime() - dateOnly(from).getTime()) / DAY + 1 > TRIPS.maxDays) return { error: `A viagem pode ter até ${TRIPS.maxDays} dias` } as const;
  const note = String(raw.note ?? "").replace(/\s+/g, " ").trim().slice(0, TRIPS.noteMax);
  if (/https?:\/\/|www\.|@\w+\.\w+|\d{4,}[\s.-]?\d{4}/i.test(note)) return { error: "Sem links, e-mails ou telefones na observação" } as const;
  return { city, state, from, to, note: note || null } as const;
}

export type TripPhase = "now" | "soon" | "later" | "past";

export function tripPhase(t: { from: string; to: string }, today: string): TripPhase {
  if (t.to < today) return "past";
  if (t.from <= today) return "now";
  return t.from <= addDays(today, TRIPS.soonDays) ? "soon" : "later";
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "10 a 14/out", "28/set a 2/out", "10/out" */
export function tripDates(from: string, to: string) {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  if (from === to) return `${fd}/${MONTHS[fm - 1]}`;
  if (fm === tm) return `${fd} a ${td}/${MONTHS[tm - 1]}`;
  return `${fd}/${MONTHS[fm - 1]} a ${td}/${MONTHS[tm - 1]}`;
}

export function tripLabel(t: { city: string; state: string; from: string; to: string }, today: string) {
  const where = `${t.city}/${t.state}`;
  const phase = tripPhase(t, today);
  if (phase === "now") return `✈️ Em ${where} até ${tripDates(t.to, t.to)}`;
  return `✈️ Vai para ${where} · ${tripDates(t.from, t.to)}`;
}
