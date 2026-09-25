/** Alertas de busca em Pessoas: regras puras (testadas em tests/searchAlerts.test.ts). */
import { LIKE_TAGS, PROFILE_TYPES, UFS, isCouple } from "@/lib/config";
import { RADII, distanceVisible, haversineKm } from "@/lib/geo";

export const ALERTS = {
  /** alertas salvos por pessoa */
  max: 3,
  /** avisos por alerta por dia (não vira spam em dia de muitas aprovações) */
  perDay: 5,
} as const;

export type AlertFilters = { tipo: string | null; uf: string | null; raio: number | null; curte: string | null; foto: boolean };

type Raw = { tipo?: unknown; uf?: unknown; raio?: unknown; curte?: unknown; foto?: unknown };

/** Filtros válidos a partir dos parâmetros de /pessoas (o que for inválido é ignorado). */
export function parseAlert(raw: Raw): AlertFilters | { error: string } {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const tipo = s(raw.tipo);
  const uf = s(raw.uf);
  const curte = s(raw.curte);
  const raioN = Number(raw.raio);
  const f: AlertFilters = {
    tipo: tipo === "CASAIS" || (tipo && tipo in PROFILE_TYPES) ? tipo : null,
    uf: uf && UFS.includes(uf) ? uf : null,
    raio: RADII.includes(raioN as (typeof RADII)[number]) ? raioN : null,
    curte: curte && LIKE_TAGS.includes(curte) ? curte : null,
    foto: raw.foto === true || raw.foto === "1" || raw.foto === "on",
  };
  if (!f.tipo && !f.uf && !f.raio && !f.curte) return { error: "Escolha pelo menos um filtro (tipo, estado, distância ou o que curte)." };
  return f;
}

/** "Casais · RS · até 100 km · curte Swing · com foto" */
export function alertLabel(f: AlertFilters) {
  const parts = [
    f.tipo ? (f.tipo === "CASAIS" ? "Casais" : PROFILE_TYPES[f.tipo as keyof typeof PROFILE_TYPES]?.label ?? f.tipo) : "Todos",
    f.uf,
    f.raio ? `até ${f.raio} km` : null,
    f.curte ? `curte ${f.curte}` : null,
    f.foto ? "com foto" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function sameFilters(a: AlertFilters, b: AlertFilters) {
  return a.tipo === b.tipo && a.uf === b.uf && a.raio === b.raio && a.curte === b.curte && a.foto === b.foto;
}

type Candidate = { profileType: string; state: string | null; likes: unknown; avatarId: string | null; showDistance: boolean; hideCity: boolean; lat: number | null; lng: number | null };
type Saver = { lat: number | null; lng: number | null };

/** O novo perfil combina com o alerta? (raio: medido de onde quem salvou está agora) */
export function matchesAlert(f: AlertFilters, c: Candidate, saver: Saver) {
  if (f.tipo === "CASAIS" ? !isCouple(c.profileType) : f.tipo && f.tipo !== c.profileType) return false;
  if (f.uf && f.uf !== c.state) return false;
  if (f.curte && !(Array.isArray(c.likes) && c.likes.includes(f.curte))) return false;
  if (f.foto && !c.avatarId) return false;
  if (f.raio) {
    if (saver.lat == null || saver.lng == null || !distanceVisible(c)) return false;
    if (haversineKm({ lat: saver.lat, lng: saver.lng }, { lat: c.lat!, lng: c.lng! }) > f.raio) return false;
  }
  return true;
}

/** Ainda cabe aviso hoje para este alerta? Devolve o novo contador. */
export function nextSent(a: { sentDay: string | null; sentCount: number }, today: string) {
  const count = a.sentDay === today ? a.sentCount : 0;
  return count >= ALERTS.perDay ? null : { sentDay: today, sentCount: count + 1 };
}
