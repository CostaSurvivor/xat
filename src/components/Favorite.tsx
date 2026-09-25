"use client";

import { useActionState, useState, useTransition } from "react";
import { saveFavoriteNote, toggleFavorite } from "@/app/actions/favorites";
import { FAVORITES } from "@/lib/favorites";

/** Estrela de favorito + anotação privada, no perfil. */
export function FavoriteBox({ targetId, initialOn, initialNote }: { targetId: string; initialOn: boolean; initialNote: string | null }) {
  const [on, setOn] = useState(initialOn);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="w-full">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        title={on ? "Tirar dos favoritos" : "Guardar nos favoritos (só você vê)"}
        onClick={() => start(async () => { const r = await toggleFavorite(targetId); setOn(r.on); setErr(r.error ?? null); })}
        className={on ? "btn-gold" : "btn-ghost"}
      >
        {on ? "★ Favorito" : "☆ Favoritar"}
      </button>
      {err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}
      {on && <NoteForm targetId={targetId} initialNote={initialNote} />}
    </div>
  );
}

export function NoteForm({ targetId, initialNote, compact = false }: { targetId: string; initialNote: string | null; compact?: boolean }) {
  const [state, action, pending] = useActionState(saveFavoriteNote.bind(null, targetId), undefined);
  const [note, setNote] = useState(initialNote ?? "");
  return (
    <form action={action} className={`${compact ? "mt-2" : "mt-3"} space-y-1.5`}>
      {!compact && <label htmlFor={`nota-${targetId}`} className="block text-xs text-mute">🔒 Anotação privada (só você vê)</label>}
      <textarea id={`nota-${targetId}`} name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={compact ? 2 : 2} maxLength={FAVORITES.noteMax}
        placeholder="Ex.: casal simpático do clube, conhecemos em março" aria-label="Anotação privada" className="input w-full text-sm" />
      <div className="flex items-center gap-2">
        <button className="btn-ghost py-1 text-xs" disabled={pending}>{pending ? "Salvando…" : "Salvar anotação"}</button>
        {state?.ok && <span role="status" className="text-xs text-emerald-700">Salva ✓</span>}
        {state?.error && <span role="alert" className="text-xs text-red-700">{state.error}</span>}
        <span className="ml-auto text-[11px] text-mute">{note.length}/{FAVORITES.noteMax}</span>
      </div>
    </form>
  );
}
