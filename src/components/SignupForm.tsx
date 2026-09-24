"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { completeGoogleSignup, signup } from "@/app/actions/auth";
import { PROFILE_TYPES, UFS, type ProfileTypeKey } from "@/lib/config";

export function SignupForm({ google }: { google?: { email: string } }) {
  const [state, action, pending] = useActionState(google ? completeGoogleSignup : signup, undefined);
  const [type, setType] = useState<ProfileTypeKey>("COUPLE_MF");
  const persons = PROFILE_TYPES[type].persons;
  return (
    <form action={action} className="space-y-4">
      <div>
        <span className="label">Quem são vocês?</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PROFILE_TYPES) as ProfileTypeKey[]).map((k) => (
            <label key={k} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm ${type === k ? "border-gold bg-wine/40 text-white" : "border-line text-mute"}`}>
              <input type="radio" name="profileType" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
              {PROFILE_TYPES[k].label}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {persons.map((p, i) => (
          <div key={`${type}-${i}`}>
            <label className="label">Nascimento: {p}</label>
            <input type="date" name={`birth${i}`} required className="input" max={new Date().toISOString().slice(0, 10)} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nick</label>
          <input name="nick" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_.]+" className="input" placeholder="casal_liberal" />
        </div>
        {google ? (
          <div>
            <label className="label">E-mail (Google)</label>
            <input value={google.email} readOnly disabled className="input opacity-70" />
          </div>
        ) : (
          <>
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label className="label">Senha</label>
              <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
            </div>
          </>
        )}
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <div>
            <label className="label">UF</label>
            <select name="state" className="input" defaultValue="SP">{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
          <div>
            <label className="label">Cidade</label>
            <input name="city" required className="input" />
          </div>
        </div>
      </div>
      <div className="space-y-2 text-sm text-mute">
        <label className="flex gap-2"><input type="checkbox" name="adult" required /> Declaro que todas as pessoas deste perfil têm 18 anos ou mais e que vou comprovar por verificação de selfie.</label>
        <label className="flex gap-2"><input type="checkbox" name="terms" required /> <span>Li e aceito os <Link href="/termos" target="_blank" className="text-gold underline">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" className="text-gold underline">Política de Privacidade</Link>.</span></label>
        <label className="flex gap-2"><input type="checkbox" name="sensitive" required /> Consinto com o tratamento de dados sensíveis sobre minha vida sexual (preferências e tipo de perfil), conforme o art. 11 da LGPD, para funcionamento da comunidade.</label>
      </div>
      {state?.error && <p className="rounded-xl bg-wine/30 px-3 py-2 text-sm text-red-200">{state.error}</p>}
      <button disabled={pending} className="btn-gold w-full py-3">{pending ? "Criando…" : google ? "Concluir cadastro" : "Criar conta"}</button>
    </form>
  );
}
