"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

type Act = (state: { ok?: boolean; error?: string } | undefined, fd: FormData) => Promise<{ ok?: boolean; error?: string } | undefined>;

/** Formulário genérico com feedback de erro/sucesso. */
export function ActionForm({ action, children, className = "", okText = "Salvo!", resetOnOk = false }: { action: Act; children: React.ReactNode; className?: string; okText?: string; resetOnOk?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    // envia por onSubmit (e não por action=) para o React não limpar os campos quando a validação falha
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
      className={className}
      aria-busy={pending}
    >
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-gold">{okText}</p>}
    </form>
  );
}

export function AutoSubmitFile({ name, accept = "image/jpeg,image/png,image/webp", label }: { name: string; accept?: string; label: string }) {
  return (
    <label className="btn-ghost cursor-pointer">
      {label}
      <input type="file" name={name} accept={accept} className="hidden" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
    </label>
  );
}
