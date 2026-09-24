"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { openTicket } from "@/app/actions/tickets";
import { TICKET_CATEGORIES } from "@/lib/tickets";
import { PROFILE_TYPES, type ProfileTypeKey } from "@/lib/config";

type Act = (s: { ok?: boolean; error?: string } | undefined, fd: FormData) => Promise<{ ok?: boolean; error?: string } | undefined>;

export function NewTicketForm({ initialCategory }: { initialCategory?: string }) {
  const [state, action, pending] = useActionState(openTicket, undefined);
  const [cat, setCat] = useState(initialCategory && initialCategory in TICKET_CATEGORIES ? initialCategory : "OTHER");
  const [ptype, setPtype] = useState<ProfileTypeKey>("COUPLE_MF");
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-mute">
          Assunto
          <select name="category" value={cat} onChange={(e) => setCat(e.target.value)} className="input mt-0.5">
            {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs text-mute">
          Título
          <input name="subject" required maxLength={120} defaultValue={cat === "NICK_CHANGE" ? "Quero trocar meu nick" : cat === "PROFILE_TYPE" ? "Quero trocar o tipo do meu perfil" : ""} key={cat} className="input mt-0.5" />
        </label>
      </div>
      {cat === "NICK_CHANGE" && (
        <label className="block text-xs text-mute">
          Novo nick desejado
          <input name="requestedNick" required pattern="[A-Za-z0-9_.]{3,20}" maxLength={20} className="input mt-0.5" placeholder="novo_nick" />
        </label>
      )}
      {cat === "PROFILE_TYPE" && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <label className="block text-xs text-mute">
            Novo tipo de perfil
            <select name="requestedType" value={ptype} onChange={(e) => setPtype(e.target.value as ProfileTypeKey)} className="input mt-0.5">
              {(Object.keys(PROFILE_TYPES) as ProfileTypeKey[]).map((k) => <option key={k} value={k}>{PROFILE_TYPES[k].label}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROFILE_TYPES[ptype].persons.map((p, i) => (
              <label key={`${ptype}-${i}`} className="text-xs text-mute">
                Nascimento: {p}
                <input type="date" name={`birth${i}`} required className="input mt-0.5" />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-mute">Se entrar uma pessoa nova no perfil, será preciso refazer a verificação por selfie com todos aparecendo.</p>
        </div>
      )}
      <textarea name="body" required maxLength={4000} className="input h-28" placeholder={cat === "NICK_CHANGE" ? "Conte o motivo da troca (opcional, mas ajuda)" : "Descreva o que aconteceu…"} />
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-gold">Abrir chamado</button>
    </form>
  );
}

export function ReplyForm({ action }: { action: Act }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <textarea name="body" required maxLength={4000} className="input h-24" placeholder="Escreva sua mensagem…" />
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-gold">Enviar</button>
    </form>
  );
}
