import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#3a0b1a_0%,_#0b0708_60%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl font-extrabold gold-text">{SITE_NAME}</Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/login" className="btn-ghost">Entrar</Link>
          <Link href="/cadastro" className="btn-gold">Criar conta</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-mute">
        Somente maiores de 18 anos · <Link href="/termos" className="underline">Termos</Link> · <Link href="/privacidade" className="underline">Privacidade</Link>
      </footer>
    </div>
  );
}
