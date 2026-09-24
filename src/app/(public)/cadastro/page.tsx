import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { getCurrentUser } from "@/server/auth";
import { googleEnabled } from "@/server/google";

export const metadata = { title: "Criar conta" };

export default async function Cadastro() {
  if (await getCurrentUser()) redirect("/feed");
  const google = googleEnabled();
  return (
    <div className="mx-auto mt-4 max-w-2xl card p-6 sm:p-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Criar conta</h1>
      <p className="mb-6 mt-1 text-sm text-mute">Casais, solteiras e solteiros liberais. Já tem conta? <Link href="/login" className="text-gold underline">Entrar</Link></p>
      {google && (
        <div className="mx-auto max-w-sm">
          <GoogleButton label="Cadastrar com Google" />
          <p className="mt-2 text-center text-xs text-mute">Você ainda informa as datas de nascimento e aceita os termos. Nada é publicado no seu Google.</p>
          <OrDivider text="ou cadastre com e-mail e senha" />
        </div>
      )}
      <SignupForm />
    </div>
  );
}
