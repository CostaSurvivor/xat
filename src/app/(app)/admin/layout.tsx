import Link from "next/link";
import { requireStaff } from "@/server/auth";

const LINKS = [
  ["/admin", "Dashboard", false],
  ["/admin/denuncias", "Denúncias", false],
  ["/admin/verificacoes", "Verificações", false],
  ["/admin/tickets", "🎫 Tickets", false],
  ["/admin/pagamentos", "Pix", true],
  ["/admin/usuarios", "Usuários", true],
  ["/admin/salas", "Salas", true],
  ["/admin/ao-vivo", "🔴 Ao vivo", false],
  ["/admin/loja", "Loja", true],
  ["/admin/avisos", "Anúncios", true],
  ["/admin/config", "⚙️ Configurações", true],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5">
        {LINKS.filter(([, , adminOnly]) => !adminOnly || user.role === "ADMIN").map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-line px-3 py-1 text-sm text-mute hover:border-gold hover:text-white">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
