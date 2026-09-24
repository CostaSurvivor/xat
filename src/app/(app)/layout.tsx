import Link from "next/link";
import { requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { CURRENCY_ICON, SITE_NAME } from "@/lib/config";
import { AppNav } from "@/components/AppNav";
import { Avatar } from "@/components/Avatar";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [balance, ann] = await Promise.all([
    balanceOf(user.id),
    db.announcement.findFirst({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/feed" className="font-[family-name:var(--font-display)] text-xl font-extrabold gold-text">{SITE_NAME}</Link>
          <div className="flex-1"><AppNav variant="top" /></div>
          <Link href="/loja" className="rounded-full border border-gold/40 px-3 py-1 text-sm text-gold hover:bg-gold/10">{CURRENCY_ICON} {balance.toLocaleString("pt-BR")}</Link>
          {(user.role === "ADMIN" || user.role === "MODERATOR") && <Link href="/admin" className="hidden rounded-full bg-wine px-3 py-1 text-xs font-bold sm:inline">ADMIN</Link>}
          <Link href="/perfil" aria-label="Meu perfil"><Avatar mediaId={user.avatarId} nick={user.nick} size={34} /></Link>
        </div>
        {user.ageVerification !== "APPROVED" && (
          <Link href="/verificacao" className="block bg-wine/60 px-4 py-1.5 text-center text-xs text-white">
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
