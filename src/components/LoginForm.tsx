"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next || "/feed"} />
      <div>
        <label className="label">E-mail</label>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label">Senha</label>
        <input name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      {state?.error && <p className="rounded-xl bg-wine/30 px-3 py-2 text-sm text-red-200">{state.error}</p>}
      <button disabled={pending} className="btn-gold w-full py-3">{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
