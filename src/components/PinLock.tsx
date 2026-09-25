"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { forgotPin, lockNow, lockStatus, pingActivity, removePin, setPin, unlock } from "@/app/actions/pinlock";
import { PIN_LOCK } from "@/lib/pinlock";

export function UnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(unlock, undefined);
  return (
    <>
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="off" autoFocus required aria-label="PIN"
          className="input text-center text-2xl tracking-[0.5em]" />
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <button className="btn-wine w-full" disabled={pending}>{pending ? "Conferindo…" : "Desbloquear"}</button>
      </form>
      <form action={forgotPin}><button className="text-xs text-mute underline">Esqueci o PIN (sair e entrar com a senha)</button></form>
    </>
  );
}

/**
 * Vigia de inatividade (só para quem tem PIN): toques e teclas contam como atividade;
 * parado além do tempo ou voltando de outro app depois dele, trava e pede o PIN.
 */
export function AppLock({ minutes }: { minutes: number }) {
  const path = usePathname();
  const last = useRef(Date.now());
  const pinged = useRef(0);
  useEffect(() => {
    const limit = minutes * 60_000;
    const go = () => location.replace(`/desbloquear?next=${encodeURIComponent(location.pathname + location.search)}`);
    const onInput = () => {
      last.current = Date.now();
      if (Date.now() - pinged.current > PIN_LOCK.touchEverySec * 1000) { pinged.current = Date.now(); void pingActivity(); }
    };
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - last.current > limit) void lockNow().then(go);
    }, 10_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current > limit) void lockNow().then(go);
      else void lockStatus().then((locked) => locked && go());
    };
    const evs = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    evs.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(tick); evs.forEach((e) => window.removeEventListener(e, onInput)); document.removeEventListener("visibilitychange", onVisible); };
  }, [minutes]);
  useEffect(() => { last.current = Date.now(); }, [path]);
  return null;
}

export function PinSettings({ active, minutes, hasPassword }: { active: boolean; minutes: number; hasPassword: boolean }) {
  const [s1, a1, p1] = useActionState(setPin, undefined);
  const [s2, a2, p2] = useActionState(removePin, undefined);
  const on = s2?.ok ? false : s1?.ok ? true : active;
  return (
    <section className="card space-y-3 p-5" id="bloqueio">
      <h2 className="font-semibold text-gold">🔒 Bloqueio por PIN {on && <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">ativo</span>}</h2>
      <p className="text-sm text-mute">Com o site parado por alguns minutos, ele trava e só abre com o PIN, mesmo com a conta logada. Fotos, conversas e avisos ficam bloqueados. Errou 5 vezes, sai da conta.</p>
      {!hasPassword && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Para usar o PIN, defina antes uma senha para a conta (logo abaixo).</p>}
      <form action={a1} className="grid gap-2 sm:grid-cols-2">
        <label><span className="label">{on ? "Novo PIN" : "PIN"} (4 a 6 números)</span><input name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" required className="input" /></label>
        <label><span className="label">Repita o PIN</span><input name="pin2" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" required className="input" /></label>
        <label><span className="label">Travar depois de</span>
          <select name="minutes" defaultValue={String(minutes)} className="input">{PIN_LOCK.options.map((m) => <option key={m} value={m}>{m} {m === 1 ? "minuto" : "minutos"} parado</option>)}</select>
        </label>
        <label><span className="label">Senha da conta</span><input name="password" type="password" autoComplete="current-password" required className="input" /></label>
        {s1?.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{s1.error}</p>}
        {s1?.ok && <p role="status" className="text-sm text-emerald-800 sm:col-span-2">{s1.msg}</p>}
        <button className="btn-gold sm:col-span-2" disabled={p1 || !hasPassword}>{on ? "Trocar PIN" : "Ativar PIN"}</button>
      </form>
      {on && (
        <form action={a2} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <label className="min-w-40 flex-1"><span className="label">Senha da conta</span><input name="password" type="password" autoComplete="current-password" required className="input" /></label>
          <button className="btn-ghost" disabled={p2}>Desativar PIN</button>
          {s2?.error && <p role="alert" className="w-full text-sm text-red-700">{s2.error}</p>}
          {s2?.ok && <p role="status" className="w-full text-sm text-mute">{s2.msg}</p>}
        </form>
      )}
    </section>
  );
}
