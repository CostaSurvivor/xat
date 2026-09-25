"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dot, useBadges } from "./Badges";

/** Computador: links em texto no topo (PV e Avisos viram ícones ao lado do avatar). */
const TOP = [
  { href: "/feed", label: "Feed" },
  { href: "/salas", label: "Salas" },
  { href: "/ao-vivo", label: "Ao vivo" },
  { href: "/pessoas", label: "Pessoas" },
  { href: "/paquera", label: "Paquera" },
  { href: "/destaques", label: "Destaques" },
  { href: "/grupos", label: "Grupos" },
  { href: "/eventos", label: "Eventos" },
  { href: "/loja", label: "Loja" },
  { href: "/trocas", label: "Trocas" },
];

/** Celular: 5 atalhos fixos embaixo (PV e Avisos ficam no topo, perfil no avatar). */
const BOTTOM = [
  { href: "/feed", label: "Feed", icon: "🔥" },
  { href: "/salas", label: "Salas", icon: "💬" },
  { href: "/paquera", label: "Paquera", icon: "💘" },
  { href: "/pessoas", label: "Pessoas", icon: "👥" },
  { href: "/ao-vivo", label: "Ao vivo", icon: "🔴" },
];

/** Menu "☰" do celular: grade de atalhos com ícone, grandes para o dedo. */
const MENU = [
  { href: "/perfil", label: "Meu perfil", icon: "👤" },
  { href: "/destaques", label: "Destaques", icon: "🏆" },
  { href: "/grupos", label: "Grupos", icon: "🫂" },
  { href: "/eventos", label: "Eventos", icon: "🎉" },
  { href: "/loja", label: "Loja", icon: "🛍️" },
  { href: "/trocas", label: "Trocas", icon: "🔄" },
  { href: "/carteira", label: "Carteira", icon: "🌶️" },
  { href: "/assinar", label: "Assinar", icon: "⭐" },
  { href: "/suporte", label: "Suporte", icon: "🎫" },
];

const active = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Caixinha de correio (PV) e sininho (Avisos) com contador, sempre no topo. */
export function HeaderIcons() {
  const path = usePathname();
  const b = useBadges();
  const icon = (href: string, emoji: string, label: string, n: number) => (
    <Link
      href={href}
      aria-label={`${label}${n ? ` (${n} novos)` : ""}`}
      title={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full text-lg ${active(path, href) ? "bg-pink-100" : "hover:bg-black/5"}`}
    >
      {emoji}
      <Dot n={n} />
    </Link>
  );
  return (
    <div className="flex items-center gap-0.5">
      {icon("/mensagens", "✉️", "Mensagens (PV)", b.pm)}
      {icon("/notificacoes", "🔔", "Avisos", b.notif)}
    </div>
  );
}

export function MobileMenu({ admin, balance }: { admin?: boolean; balance?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = [...MENU, ...(admin ? [{ href: "/admin", label: "Admin", icon: "🛡️" }] : [])];
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-lg leading-none">☰</button>
      {/* portal: o header tem backdrop-blur, que prende elementos "fixed" dentro dele */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <nav className="w-full rounded-t-2xl bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Mais opções">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            {balance && <p className="mb-3 text-center text-sm text-mute">Saldo: <b className="text-gold">{balance}</b></p>}
            <div className="grid grid-cols-3 gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs ${active(path, l.href) ? "border-wine2 bg-pink-50 font-semibold text-wine" : "border-line"}`}
                >
                  <span className="text-2xl">{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </div>
            <button onClick={() => setOpen(false)} className="btn-ghost mt-3 w-full">Fechar</button>
          </nav>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  if (variant === "top")
    return (
      <nav className="hidden flex-wrap items-center gap-1 md:flex">
        {TOP.map((l) => (
          <Link key={l.href} href={l.href} className={`rounded-full px-3 py-1.5 text-sm ${active(path, l.href) ? "bg-wine text-white" : "text-mute hover:text-fg"}`}>{l.label}</Link>
        ))}
      </nav>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navegação principal">
      {BOTTOM.map((l) => (
        <Link key={l.href} href={l.href} className={`flex flex-col items-center py-2 text-[11px] ${active(path, l.href) ? "font-semibold text-wine" : "text-mute"}`}>
          <span className="text-xl leading-6">{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
