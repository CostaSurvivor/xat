import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getHeroImage } from "@/server/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const hero = await getHeroImage();
  const bg = hero ? `/api/public/hero?v=${hero.v}` : "/hero.svg";
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink">
      {/* fundo: foto (Admin → Configurações) ou arte padrão, bem opaco atrás do conteúdo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" className={`h-full w-full object-cover ${hero ? "opacity-35" : "opacity-90"}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/60" />
      </div>
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" aria-label="Início"><Logo size={34} /></Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/login" className="btn-ghost">Entrar</Link>
          <Link href="/cadastro" className="btn-gold">Criar conta</Link>
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16">{children}</main>
      <footer className="relative z-10 mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-mute">
        Somente maiores de 18 anos · <Link href="/termos" className="underline">Termos</Link> · <Link href="/privacidade" className="underline">Privacidade</Link>
      </footer>
    </div>
  );
}
