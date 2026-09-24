import Link from "next/link";
import { ActionForm } from "@/components/Forms";
import { googleTwoFactor } from "@/app/actions/auth";
import { getPending, type PendingTwoFa } from "@/server/google";

export const metadata = { title: "Código de verificação" };
export const dynamic = "force-dynamic";

export default async function LoginGoogle2fa() {
  const pending = await getPending<PendingTwoFa>("TWOFA");
  return (
    <div className="mx-auto mt-10 max-w-sm card p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Verificação em duas etapas</h1>
      {pending ? (
        <ActionForm action={googleTwoFactor} className="mt-4 space-y-3">
          <label className="label" htmlFor="code">Código do app autenticador</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="input text-center text-lg tracking-[0.4em]" placeholder="000000" />
          <button className="btn-gold w-full">Confirmar</button>
        </ActionForm>
      ) : (
        <p className="mt-3 text-sm text-mute">Sessão expirada. <Link href="/login" className="text-gold underline">Entrar de novo</Link></p>
      )}
    </div>
  );
}
