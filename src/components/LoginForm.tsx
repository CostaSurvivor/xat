"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next || "/feed"} />
      <div>
        <label className="label">E-mail</label>
        <input name="email" type="email" required className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Senha</label>
        <input name="password" type="password" required className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {state?.need2fa && (
        <div>
          <label className="label">Código do app autenticador</label>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="input text-center text-lg tracking-[0.4em]" placeholder="000000" />
        </div>
      )}
      {state?.error && <p className="rounded-xl bg-wine/30 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-gold w-full py-3">{pending ? "Entrando…" : state?.need2fa ? "Confirmar código" : "Entrar"}</button>
      <a href="/esqueci" className="block text-center text-xs text-mute underline">Esqueci minha senha</a>
    </form>
  );
}
