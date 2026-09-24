import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/server/auth";

export const metadata = { title: "Entrar" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/feed");
  const { next } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm card p-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Entrar</h1>
      <p className="mb-6 mt-1 text-sm text-mute">Novo por aqui? <Link href="/cadastro" className="text-gold underline">Criar conta</Link></p>
      <LoginForm next={next} />
    </div>
  );
}
