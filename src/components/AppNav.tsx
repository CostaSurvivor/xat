"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dot, useBadges } from "./Badges";

/** Computador: 5 links principais numa linha só; o resto fica em "Mais ▾". */
const TOP = [
  { href: "/feed", label: "Feed" },
  { href: "/salas", label: "Salas" },
  { href: "/ao-vivo", label: "Ao vivo" },
  { href: "/pessoas", label: "Pessoas" },
  { href: "/paquera", label: "Paquera" },
];
const MORE = [
  { href: "/destaques", label: "Destaques", icon: "🏆" },
  { href: "/grupos", label: "Grupos", icon: "🫂" },
  { href: "/eventos", label: "Eventos", icon: "🎉" },
  { href: "/loja", label: "Loja", icon: "🛍️" },
  { href: "/trocas", label: "Trocas", icon: "🔄" },
  { href: "/carteira", label: "Carteira", icon: "🌶️" },
  { href: "/assinar", label: "Assinar", icon: "⭐" },
  { href: "/suporte", label: "Suporte", icon: "🎫" },
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

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

/** Caixinha de correio (PV) e sininho (Avisos) com contador, sempre no topo. */
export function HeaderIcons() {
  const path = usePathname();
  const b = useBadges();
  const icon = (href: string, glyph: React.ReactNode, label: string, n: number) => (
    <Link
      href={href}
      aria-label={`${label}${n ? ` (${n} novos)` : ""}`}
      title={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full ${active(path, href) ? "bg-pink-100 text-wine" : "text-fg/70 hover:bg-black/5 hover:text-fg"}`}
    >
      {glyph}
      <Dot n={n} />
    </Link>
  );
  return (
    <div className="flex items-center gap-0.5">
      {icon("/mensagens", <MailIcon />, "Mensagens (PV)", b.pm)}
      {icon("/notificacoes", <BellIcon />, "Avisos", b.notif)}
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

export function AppNav({ variant, admin }: { variant: "top" | "bottom"; admin?: boolean }) {
  const path = usePathname();
  if (variant === "top") return <DesktopNav path={path} admin={admin} />;
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

/** Topo do computador: 5 links + "Mais ▾" com o resto (fecha ao clicar fora, com Esc ou ao navegar). */
function DesktopNav({ path, admin }: { path: string; admin?: boolean }) {
  const more = [...MORE, ...(admin ? [{ href: "/admin", label: "Admin", icon: "🛡️" }] : [])];
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const moreActive = MORE.some((l) => active(path, l.href));
  const pill = (on: boolean) => `whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${on ? "bg-wine text-white" : "text-mute hover:bg-black/5 hover:text-fg"}`;
  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navegação principal (computador)">
      {TOP.map((l) => (
        <Link key={l.href} href={l.href} className={pill(active(path, l.href))}>{l.label}</Link>
      ))}
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={pill(moreActive)}>
          Mais <span className="text-xs">▾</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div role="menu" className="card absolute left-0 top-10 z-50 grid w-72 grid-cols-2 gap-1 p-2 shadow-lg">
              {more.map((l) => (
                <Link key={l.href} role="menuitem" href={l.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active(path, l.href) ? "bg-pink-50 font-semibold text-wine" : "hover:bg-black/5"}`}>
                  <span>{l.icon}</span>{l.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
