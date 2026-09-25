"use client";

import { useActionState, useTransition } from "react";
import { addTrip, deleteTrip } from "@/app/actions/trips";
import { TRIPS } from "@/lib/trips";
import { CityFields } from "./CityFields";

/** Formulário "Estou viajando". Em caso de erro, remonta com o que a pessoa digitou (o React limpa o form após a ação). */
export function TripForm({ today, defaultState }: { today: string; defaultState: string }) {
  const [state, action, pending] = useActionState(addTrip, undefined);
  const v = state?.ok ? undefined : state?.values;
  return (
    <form key={state?.n ?? 0} action={action} className="space-y-3">
      <CityFields defaultState={v?.state || defaultState} defaultCity={v?.city ?? ""} required />
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Ida</span><input type="date" name="from" required min={today} defaultValue={v?.from ?? ""} className="input" /></label>
        <label><span className="label">Volta</span><input type="date" name="to" required min={today} defaultValue={v?.to ?? ""} className="input" /></label>
      </div>
      <label className="block"><span className="label">Observação (opcional)</span>
        <input name="note" maxLength={TRIPS.noteMax} defaultValue={v?.note ?? ""} className="input" placeholder="Ex.: casal a trabalho, livres à noite" />
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Viagem anunciada ✈️ Quem mora lá já pode ver vocês.</p>}
      <button className="btn-gold w-full" disabled={pending}>{pending ? "Salvando…" : "✈️ Anunciar viagem"}</button>
    </form>
  );
}

export function TripDeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => deleteTrip(id))} className="text-xs text-mute hover:text-red-700" aria-label="Apagar viagem">🗑 Apagar</button>
  );
}
