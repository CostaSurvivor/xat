/** Relatório do admin: funções puras (testadas em tests/report.test.ts). */

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const parsePeriod = (v: unknown): Period => (PERIODS as readonly number[]).includes(Number(v)) ? (Number(v) as Period) : 7;

/** Dia (AAAA-MM-DD) no horário de Brasília (UTC-3, sem horário de verão). */
export function brDay(d: Date) {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Série diária contínua (dias sem dado viram 0), terminando em `end`. */
export function fillDays(rows: { day: string; value: number }[], days: number, end = new Date()) {
  const map = new Map(rows.map((r) => [r.day, Number(r.value)]));
  const out: { day: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = brDay(new Date(end.getTime() - i * 86400_000));
    out.push({ day, value: map.get(day) ?? 0 });
  }
  return out;
}

/** Variação contra o período anterior. `null` quando não dá para comparar (anterior = 0). */
export function delta(cur: number, prev: number) {
  if (!prev) return cur ? { pct: null, dir: "up" as const } : { pct: 0, dir: "flat" as const };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, dir: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const) };
}

/** Topo "redondo" do eixo e 4 marcas (0, 1/4, …): 0 / 5 / 10 / 15 / 20. */
export function niceScale(max: number) {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const clean = step < 1 ? 1 : step;
  return { top: clean * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * clean) };
}

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace(".", ",")} mil` : n.toLocaleString("pt-BR");

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "24/09" a partir de "2026-09-24". */
export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
