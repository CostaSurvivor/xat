"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions/account";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <form action={action} className="space-y-2">
      <input name="password" type="password" required placeholder="Sua senha" className="input" />
      <input name="confirm" required placeholder='Digite "EXCLUIR"' className="input" />
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-wine">Excluir minha conta para sempre</button>
    </form>
  );
}
