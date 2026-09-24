import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { getCurrentUser } from "@/server/auth";
import { googleEnabled } from "@/server/google";

export const metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  "google-off": "O login com Google ainda não está disponível. Entre com e-mail e senha.",
  "google-falhou": "Não foi possível entrar com o Google. Tente de novo.",
  "google-vincular": "Já existe uma conta com esse e-mail. Entre com sua senha e vincule o Google em Conta → Login com Google.",
  "muitas-tentativas": "Muitas tentativas. Aguarde alguns minutos.",
  banido: "Conta banida.",
  excluida: "Conta excluída.",
  bloqueado: "Acesso bloqueado.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  if (await getCurrentUser()) redirect("/feed");
  const { next, erro } = await searchParams;
  const google = googleEnabled();
  return (
    <div className="mx-auto mt-10 max-w-sm card p-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Entrar</h1>
      <p className="mb-6 mt-1 text-sm text-mute">Novo por aqui? <Link href="/cadastro" className="text-gold underline">Criar conta</Link></p>
      {erro && ERROS[erro] && <p className="mb-4 rounded-xl bg-wine/30 px-3 py-2 text-sm text-red-200">{ERROS[erro]}</p>}
      {google && (
        <>
          <GoogleButton next={next} />
          <OrDivider text="ou com e-mail e senha" />
        </>
      )}
      <LoginForm next={next} />
    </div>
  );
}
