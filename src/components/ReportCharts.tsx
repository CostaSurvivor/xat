"use client";

import { useState } from "react";
import { brl, compact, niceScale, shortDay } from "@/lib/report";

const HUE = "#d81b60"; // wine2 (validado contra o fundo branco)
const GRID = "#eee6ea";

/** Colunas diárias (uma série): barra ≤ 24px, topo arredondado 4px, base reta; tooltip ao passar o dedo/mouse. */
export function ColumnChart({ data, kind, label }: { data: { day: string; value: number }[]; kind: "count" | "money"; label: string }) {
  const format = (n: number) => (kind === "money" ? brl(n).replace(",00", "") : compact(n));
  const [hover, setHover] = useState<number | null>(null);
  const W = 400, H = 190, L = 46, B = 22, T = 16;
  const { top, ticks } = niceScale(Math.max(...data.map((d) => d.value)));
  const slot = (W - L) / data.length;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const maxIdx = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="13" fill="#6b5f64">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const top0 = y(d.value), base = y(0);
          const r = Math.min(4, bw / 2, base - top0);
          const path = d.value > 0 ? `M${x},${base} V${top0 + r} Q${x},${top0} ${x + r},${top0} H${x + bw - r} Q${x + bw},${top0} ${x + bw},${top0 + r} V${base} Z` : "";
          return (
            <g key={d.day}>
              {path && <path d={path} fill={HUE} opacity={hover === null || hover === i ? 1 : 0.45} />}
              {/* alvo de toque maior que a barra */}
              <rect x={L + i * slot} y={T} width={slot} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            </g>
          );
        })}
        {data[maxIdx].value > 0 && (
          <text x={L + maxIdx * slot + slot / 2} y={y(data[maxIdx].value) - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1e1519">{format(data[maxIdx].value)}</text>
        )}
        {[...new Set(labelIdx)].map((i) => (
          <text key={i} x={L + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="13" fill="#6b5f64">{shortDay(data[i].day)}</text>
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-lg border border-line bg-white px-2 py-1 text-xs shadow" role="status">
          <span className="text-mute">{shortDay(h.day)}:</span> <b>{format(h.value)}</b>
        </div>
      )}
    </div>
  );
}

/** Ranking em barras horizontais: rótulo, barra e valor na ponta (texto em cor de texto, nunca na cor da barra). */
export function HBars({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-mute">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 text-sm" title={`${r.label}: ${r.value.toLocaleString("pt-BR")}`}>
          <span className="truncate text-mute">{r.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 rounded-r" style={{ width: `${Math.max(2, (r.value / max) * 85)}%`, background: HUE }} />
            <span className="text-xs font-semibold text-fg">{r.value.toLocaleString("pt-BR")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
