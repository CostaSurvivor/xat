/**
 * Proximidade (estilo "Radar"): coordenadas por cidade (base do IBGE em src/data/municipios.json,
 * de github.com/kelvins/municipios-brasileiros) ou localização aproximada do aparelho.
 * Privacidade: coordenadas guardadas com 2 casas (~1 km) e distância exibida só em faixas.
 */
import MUNICIPIOS from "@/data/municipios.json";

type Row = [string, string, number, number];

/** "São José dos Campos " -> "sao jose dos campos" */
export function normalizeCity(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

let index: Map<string, [number, number]> | null = null;
function idx() {
  if (!index) {
    index = new Map();
    for (const [name, uf, lat, lng] of MUNICIPIOS as Row[]) index.set(`${uf}|${normalizeCity(name)}`, [lat, lng]);
  }
  return index;
}

/** Coordenadas da cidade (null se não achar na UF). */
export function cityCoords(city: string | null | undefined, uf: string | null | undefined): { lat: number; lng: number } | null {
  if (!city || !uf) return null;
  const hit = idx().get(`${uf}|${normalizeCity(city)}`);
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}

/** Nomes das cidades de uma UF (para as sugestões do campo cidade). */
export function citiesOf(uf: string) {
  return (MUNICIPIOS as Row[]).filter((r) => r[1] === uf).map((r) => r[0]);
}

/** Arredonda para 2 casas (~1,1 km): nunca guardamos a posição exata. */
export const roundCoord = (x: number) => Math.round(x * 100) / 100;

export function validLatLng(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) &&
    // Brasil com folga
    lat > -35 && lat < 6 && lng > -75 && lng < -28;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distância em faixas (evita descobrir a posição por triangulação). */
export function distanceLabel(km: number) {
  if (km < 5) return "até 5 km";
  if (km < 50) return `~${Math.ceil(km / 5) * 5} km`;
  if (km < 200) return `~${Math.ceil(km / 10) * 10} km`;
  return `~${Math.ceil(km / 50) * 50} km`;
}

/** Caixa (lat/lng mín./máx.) para pré-filtrar no banco antes do cálculo exato. */
export function boundingBox(c: { lat: number; lng: number }, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)));
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

export const RADII = [10, 25, 50, 100, 300] as const;

/** Distância só aparece (e a pessoa só entra na busca por raio) se ela permitir e não esconder a cidade. */
export const distanceVisible = (u: { showDistance: boolean; hideCity: boolean; lat: number | null; lng: number | null }) =>
  u.showDistance && !u.hideCity && u.lat != null && u.lng != null;

/** Coordenadas a gravar quando a pessoa muda a cidade (localização do aparelho, se ativa, é mantida). */
export function coordsForProfile(city: string | null, uf: string, current: { geoSource: string | null }) {
  if (current.geoSource === "GPS") return {};
  const c = cityCoords(city, uf);
  return c ? { lat: c.lat, lng: c.lng, geoSource: "CITY" } : { lat: null, lng: null, geoSource: null };
}
