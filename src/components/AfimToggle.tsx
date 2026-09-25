"use client";

import { useActionState, useState } from "react";
import { clearAfim, setAfim } from "@/app/actions/afim";
import { AFIM, AFIM_SUGGESTIONS } from "@/lib/afim";

/** Card para ligar/desligar o "🔥 Afim hoje" (em Pessoas e no próprio perfil). */
export function AfimToggle({ active, untilLabel, note }: { active: boolean; untilLabel?: string; note?: string | null }) {
  const [state, action, pending] = useActionState(setAfim, undefined);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (active)
    return (
      <div className="card flex flex-wrap items-center gap-2 border-wine/40 bg-pink-50/60 px-4 py-2.5 text-sm" data-testid="afim-ligado">
        <span className="font-semibold text-wine">🔥 Você está afim hoje</span>
        <span className="text-mute">{untilLabel}</span>
        {note && <span className="min-w-0 truncate italic text-mute">“{note}”</span>}
        <form action={clearAfim} className="ml-auto"><button className="btn-ghost px-3 py-1 text-xs">Desligar</button></form>
      </div>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`card flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:border-wine/50`} data-testid="afim-abrir">
        <span className="text-lg">🔥</span>
        <span><b>Afim hoje?</b> <span className="text-mute">Ligue o status e apareça para quem também quer sair</span></span>
        <span className="ml-auto text-wine">ligar →</span>
      </button>
    );

  return (
    <form action={action} className="card space-y-2 p-4 text-sm" data-testid="afim-form">
      <div className="font-semibold">🔥 Afim hoje</div>
      <div className="flex flex-wrap gap-1">
        {AFIM_SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-wine hover:text-wine">{s}</button>
        ))}
      </div>
      <input name="note" value={text} onChange={(e) => setText(e.target.value)} maxLength={AFIM.noteMax} placeholder="Recado curto (opcional) — sem telefone ou links" className="input w-full" aria-label="Recado" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-mute" htmlFor="afim-hours">Por</label>
        <select id="afim-hours" name="hours" defaultValue={AFIM.defaultHours} className="input w-auto">
          {AFIM.hours.map((h) => <option key={h} value={h}>{h} horas</option>)}
        </select>
        <button className="btn-wine" disabled={pending}>{pending ? "Ligando…" : "Ligar"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
      {state?.error && <p role="alert" className="text-wine">{state.error}</p>}
      <p className="text-xs text-mute">Aparece no seu perfil e em Pessoas com o filtro “🔥 afim hoje”. Some sozinho no fim do prazo.</p>
    </form>
  );
}
