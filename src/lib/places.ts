/** Lugares: regras puras (testadas em tests/places.test.ts). */
import { UFS } from "@/lib/config";
import { forbiddenReason } from "@/lib/contos";

export const PLACE_KINDS = {
  CLUBE: { label: "Casa de swing / clube", icon: "🥂" },
  BAR: { label: "Bar / balada", icon: "🍸" },
  SAUNA: { label: "Sauna", icon: "♨️" },
  MOTEL: { label: "Motel / suíte temática", icon: "🛏️" },
  PRAIA: { label: "Praia / área de naturismo", icon: "🏖️" },
  OUTRO: { label: "Outro", icon: "📍" },
} as const;
export type PlaceKind = keyof typeof PLACE_KINDS;

export const PLACES = { suggestPerDay: 3, pageSize: 60, reviewMax: 1000, descMax: 1000 } as const;

const str = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export type PlaceInput = { name: string; kind: PlaceKind; state: string; city: string; address: string | null; site: string | null; description: string | null };

/** Valida a sugestão de lugar. */
export function parsePlace(raw: Record<string, unknown>): PlaceInput | { error: string } {
  const name = str(raw.name);
  const kind = str(raw.kind);
  const state = str(raw.state);
  const city = str(raw.city);
  const address = str(raw.address) || null;
  const siteRaw = str(raw.site);
  const description = typeof raw.description === "string" ? raw.description.replace(/\r\n?/g, "\n").trim() || null : null;
  if (name.length < 3 || name.length > 80) return { error: "Nome do lugar: de 3 a 80 letras." };
  if (!(kind in PLACE_KINDS)) return { error: "Escolha o tipo de lugar." };
  if (!UFS.includes(state)) return { error: "Escolha o estado." };
  if (city.length < 2 || city.length > 80) return { error: "Informe a cidade." };
  if (address && address.length > 160) return { error: "Endereço muito longo." };
  if (description && description.length > PLACES.descMax) return { error: `Descrição de até ${PLACES.descMax} letras.` };
  let site: string | null = null;
  if (siteRaw) {
    const withProto = /^https?:\/\//i.test(siteRaw) ? siteRaw : `https://${siteRaw}`;
    try {
      const u = new URL(withProto);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || withProto.length > 120) throw new Error();
      site = u.toString();
    } catch {
      return { error: "Site inválido (ex.: www.exemplo.com.br)." };
    }
  }
  const why = forbiddenReason(`${name}\n${description ?? ""}`);
  if (why) return { error: `Não aceitamos lugares com ${why}.` };
  return { name, kind: kind as PlaceKind, state, city, address, site, description };
}

/** Valida a avaliação (1 a 5 estrelas + comentário opcional). */
export function parseReview(raw: { stars: unknown; body: unknown }): { stars: number; body: string | null } | { error: string } {
  const stars = Number(raw.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "Escolha de 1 a 5 estrelas." };
  const body = typeof raw.body === "string" ? raw.body.replace(/\r\n?/g, "\n").trim() || null : null;
  if (body && body.length > PLACES.reviewMax) return { error: `Comentário de até ${PLACES.reviewMax} letras.` };
  const why = body && forbiddenReason(body);
  if (why) return { error: `Comentários com ${why} não são permitidos.` };
  if (body && /(\d[\s().-]*){8,}/.test(body)) return { error: "Sem telefone no comentário." };
  return { stars, body };
}

/** Média com uma casa ("4,5") ou null sem avaliações. */
export function avgStars(sum: number, count: number) {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

export function starsText(avg: number) {
  const full = Math.round(avg);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/** Nova soma/contagem ao criar, trocar ou apagar uma avaliação. */
export function ratingDelta(prev: number | null, next: number | null) {
  return { sum: (next ?? 0) - (prev ?? 0), count: (next != null ? 1 : 0) - (prev != null ? 1 : 0) };
}
