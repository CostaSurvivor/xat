"use client";

import { useActionState } from "react";
import { deleteSearchAlert, saveSearchAlert } from "@/app/actions/searchAlerts";
import { ALERTS } from "@/lib/searchAlerts";

type Filters = { tipo?: string; uf?: string; raio?: string; curte?: string; foto?: string };

/** "🔔 Me avise": salva os filtros atuais de Pessoas + lista dos meus alertas. */
export function SearchAlerts({ current, alerts, canSave }: { current: Filters; alerts: { id: string; label: string }[]; canSave: boolean }) {
  const [state, action, pending] = useActionState(saveSearchAlert, undefined);
  return (
    <div className="card space-y-2 px-4 py-3 text-sm" data-testid="alertas">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">🔔 Alertas de novos perfis</span>
        <span className="text-xs text-mute">avisamos quando alguém novo e verificado combinar com seus filtros</span>
        {canSave && (
          <form action={action} className="ml-auto">
            {Object.entries(current).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
            <button className="btn-gold px-3 py-1 text-xs" disabled={pending} data-testid="criar-alerta">{pending ? "Salvando…" : "🔔 Me avise com estes filtros"}</button>
          </form>
        )}
      </div>
      {!canSave && alerts.length === 0 && <p className="text-xs text-mute">Escolha tipo, estado, distância ou o que curte e toque em Buscar para criar um alerta.</p>}
      {state?.error && <p role="alert" className="text-xs text-wine">{state.error}</p>}
      {state?.msg && <p role="status" className="text-xs text-emerald-700">{state.msg}</p>}
      {alerts.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-1 rounded-full border border-line bg-panel2 py-0.5 pl-3 pr-1 text-xs" data-testid="alerta">
              <span>{a.label}</span>
              <form action={deleteSearchAlert.bind(null, a.id)}><button className="rounded-full px-1.5 text-mute hover:text-wine" aria-label={`Apagar alerta ${a.label}`}>✕</button></form>
            </li>
          ))}
          <li className="self-center text-[11px] text-mute">{alerts.length}/{ALERTS.max}</li>
        </ul>
      )}
    </div>
  );
}
