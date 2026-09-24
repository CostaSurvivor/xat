"use client";

import { useActionState } from "react";

type Act = (state: { ok?: boolean; error?: string } | undefined, fd: FormData) => Promise<{ ok?: boolean; error?: string } | undefined>;

/** canPromote: só a equipe do site escolhe moderadores (e nunca na Geral/Só Casais). */
export function MemberManager({ action, canPromote }: { action: Act; canPromote: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <input name="nick" required placeholder="nick" className="input w-40" />
      <select name="op" className="input w-auto">
        <option value="add">Adicionar membro</option>
        {canPromote && <option value="promote">Tornar moderador</option>}
        {canPromote && <option value="demote">Remover moderador</option>}
        <option value="remove">Remover da sala</option>
        <option value="unban">Desbanir / dessilenciar</option>
      </select>
      <button disabled={pending} className="btn-wine">Aplicar</button>
      {state?.error && <span className="text-sm text-red-300">{state.error}</span>}
      {state?.ok && <span className="text-sm text-gold">Feito!</span>}
    </form>
  );
}
