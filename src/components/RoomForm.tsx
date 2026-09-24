"use client";

import { useActionState } from "react";
import { UFS } from "@/lib/config";

type Room = { name: string; description: string | null; rules: string | null; state: string | null; city: string | null; access: string; theme: string; linksAllowed: boolean };
type Act = (state: { ok?: boolean; error?: string } | undefined, fd: FormData) => Promise<{ ok?: boolean; error?: string } | undefined>;

/** Edição de sala (as salas são fixas da plataforma; não há criação). */
export function RoomForm({ action, room, bannedWords }: { action: Act; room?: Room; bannedWords?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input name="name" required maxLength={60} defaultValue={room?.name} className="input" />
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <div>
            <label className="label">UF</label>
            <select name="state" defaultValue={room?.state ?? ""} className="input"><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
          <div>
            <label className="label">Cidade</label>
            <input name="city" maxLength={80} defaultValue={room?.city ?? ""} className="input" />
          </div>
        </div>
      </div>
      <div>
        <label className="label">Descrição</label>
        <textarea name="description" maxLength={500} defaultValue={room?.description ?? ""} className="input h-20" />
      </div>
      <div>
        <label className="label">Regras</label>
        <textarea name="rules" maxLength={3000} defaultValue={room?.rules ?? ""} className="input h-24" placeholder="Respeito acima de tudo. Sem fotos de terceiros…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Quem pode entrar</label>
          <select name="access" defaultValue={room?.access ?? "PUBLIC"} className="input">
            <option value="PUBLIC">Todos</option>
            <option value="VERIFIED_ONLY">Só verificados</option>
            <option value="COUPLES_ONLY">Só casais</option>
            <option value="MEMBERS_ONLY">Só membros (convite)</option>
          </select>
        </div>
        <div>
          <label className="label">Tema</label>
          <select name="theme" defaultValue={room?.theme ?? "noir"} className="input">
            <option value="noir">Noir</option>
            <option value="vinho">Vinho</option>
            <option value="ouro">Ouro</option>
            <option value="neon">Neon</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-mute"><input type="checkbox" name="linksAllowed" defaultChecked={room?.linksAllowed} /> Permitir links no chat</label>
      <div>
        <label className="label">Palavras bloqueadas (separe por vírgula)</label>
        <textarea name="bannedWords" defaultValue={bannedWords} className="input h-20" />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-gold">Salvo!</p>}
      <button disabled={pending} className="btn-gold">Salvar</button>
    </form>
  );
}
