"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dot, useBadges } from "./Badges";

const LINKS = [
  { href: "/feed", label: "Feed", icon: "🔥" },
  { href: "/salas", label: "Salas", icon: "💬" },
  { href: "/ao-vivo", label: "Ao vivo", icon: "🔴" },
  { href: "/pessoas", label: "Pessoas", icon: "👥" },
  { href: "/mensagens", label: "PV", icon: "✉️", badge: "pm" as const },
  { href: "/notificacoes", label: "Avisos", icon: "🔔", badge: "notif" as const },
];
const EXTRA = [
  { href: "/destaques", label: "Destaques" },
  { href: "/grupos", label: "Grupos" },
  { href: "/eventos", label: "Eventos" },
  { href: "/visitas", label: "Visitas" },
  { href: "/loja", label: "Loja" },
  { href: "/trocas", label: "Trocas" },
];

/** Menu "☰" do celular: as páginas que não cabem na barra de baixo. */
export function MobileMenu({ admin }: { admin?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = [...EXTRA, { href: "/perfil", label: "Meu perfil" }, { href: "/carteira", label: "Carteira" }, { href: "/assinar", label: "Assinar" }, { href: "/suporte", label: "Suporte" }, ...(admin ? [{ href: "/admin", label: "Admin" }] : [])];
  return (
    <div className="relative md:hidden">
      <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open} className="rounded-full border border-line bg-panel px-3 py-1 text-lg leading-none">☰</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <nav className="card absolute right-0 top-10 z-50 w-48 overflow-hidden py-1 shadow-lg">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`block px-4 py-2.5 text-sm ${path.startsWith(l.href) ? "bg-pink-50 font-semibold text-wine" : "hover:bg-black/5"}`}>{l.label}</Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const b = useBadges();
  if (variant === "top")
    return (
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`relative rounded-full px-3 py-1.5 text-sm ${path.startsWith(l.href) ? "bg-wine text-white" : "text-mute hover:text-fg"}`}>
            {l.label}
            {l.badge && <Dot n={b[l.badge]} />}
          </Link>
        ))}
        {EXTRA.map((l) => (
          <Link key={l.href} href={l.href} className={`rounded-full px-3 py-1.5 text-sm ${path.startsWith(l.href) ? "bg-wine text-white" : "text-mute hover:text-fg"}`}>{l.label}</Link>
        ))}
      </nav>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`flex flex-col items-center py-2 text-[11px] ${path.startsWith(l.href) ? "text-gold" : "text-mute"}`}>
          <span className="relative text-lg">{l.icon}{l.badge && <Dot n={b[l.badge]} />}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
