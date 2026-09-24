"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, resetPassword } from "@/app/actions/auth";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" required placeholder="Seu e-mail" className="input" />
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      {state?.ok && <p className="text-sm text-gold">{state.ok}</p>}
      <button disabled={pending} className="btn-gold w-full">Enviar link</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  if (state?.ok) return <p className="text-gold">{state.ok} <Link href="/login" className="underline">Entrar</Link></p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input name="password" type="password" required minLength={8} placeholder="Nova senha (8+)" className="input" autoComplete="new-password" />
      <input name="confirm" type="password" required minLength={8} placeholder="Repita a nova senha" className="input" autoComplete="new-password" />
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      <button disabled={pending} className="btn-gold w-full">Salvar nova senha</button>
    </form>
  );
}
