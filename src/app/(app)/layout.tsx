import Link from "next/link";
import { isSubscriber, requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { CURRENCY_ICON } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { AppNav, HeaderIcons, MobileMenu } from "@/components/AppNav";
import { Avatar } from "@/components/Avatar";
import { db } from "@/lib/db";
import { InstallApp } from "@/components/InstallApp";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [balance, ann] = await Promise.all([
    balanceOf(user.id),
    db.announcement.findFirst({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Link href="/feed" aria-label="Feed"><Logo size={28} /></Link>
          <div className="min-w-0 flex-1"><AppNav variant="top" admin={user.role === "ADMIN" || user.role === "MODERATOR"} /></div>
          <InstallApp />
          {!isSubscriber(user) && <Link href="/assinar" className="hidden whitespace-nowrap rounded-full bg-gradient-to-r from-gold to-gold2 px-3 py-1 text-xs font-bold text-white lg:inline">⭐ Assine</Link>}
          <Link href="/loja" className="hidden whitespace-nowrap rounded-full border border-gold/40 px-3 py-1 text-sm text-gold hover:bg-gold/10 md:inline">{CURRENCY_ICON} {balance.toLocaleString("pt-BR")}</Link>
          <HeaderIcons />
          <Link href="/perfil" aria-label="Meu perfil"><Avatar mediaId={user.avatarId} nick={user.nick} size={34} /></Link>
          <MobileMenu admin={user.role === "ADMIN" || user.role === "MODERATOR"} balance={`${CURRENCY_ICON} ${balance.toLocaleString("pt-BR")}`} />
        </div>
        {user.ageVerification !== "APPROVED" && (
          <Link href="/verificacao" className="block bg-wine px-4 py-1.5 text-center text-xs text-white">
            {user.ageVerification === "PENDING" ? "⏳ Verificação em análise: logo você libera fotos, PV com fotos e a loja." : "🔒 Verifique seu perfil com uma selfie para liberar fotos, PV com fotos e a loja →"}
          </Link>
        )}
        {ann && <div className="bg-gold/15 px-4 py-1.5 text-center text-xs text-gold2">📢 {ann.body}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">{children}</main>
      <AppNav variant="bottom" />
    </div>
  );
}
