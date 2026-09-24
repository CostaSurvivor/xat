import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { getCurrentUser } from "@/server/auth";
import { getPending, type PendingSignup } from "@/server/google";

export const metadata = { title: "Concluir cadastro" };
export const dynamic = "force-dynamic";

export default async function CadastroGoogle() {
  if (await getCurrentUser()) redirect("/feed");
  const pending = await getPending<PendingSignup>("SIGNUP");
  if (!pending)
    return (
      <div className="mx-auto mt-10 max-w-sm card p-8 text-center">
        <p>Sua sessão do Google expirou.</p>
        <Link href="/cadastro" className="btn-gold mt-4">Começar de novo</Link>
      </div>
    );
  return (
    <div className="mx-auto mt-4 max-w-2xl card p-6 sm:p-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Quase lá!</h1>
      <p className="mb-6 mt-1 text-sm text-mute">
        Conectado como <b className="text-white">{pending.data.email}</b>. Complete o perfil: as datas de nascimento de todos são obrigatórias (18+).
      </p>
      <SignupForm google={{ email: pending.data.email }} />
    </div>
  );
}
