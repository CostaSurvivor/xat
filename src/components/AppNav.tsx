"use client";

import { FEATURES } from "@/lib/features";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dot, useBadges } from "./Badges";
import { QuickExitButton } from "./QuickExit";

const Svg = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

/** "Mais": só o que não tem ícone no topo (Destaques está no feed; Suporte, saldo e Assine no topo). Admin, discreto, só para a equipe. */
const MORE = [
  { href: "/pessoas", label: "Pessoas", icon: "👥" },
  { href: "/destaques", label: "Destaques", icon: "🏆" },
  { href: "/grupos", label: "Grupos", icon: "🫂" },
  { href: "/eventos", label: "Eventos", icon: "🎉" },
  { href: "/contos", label: "Contos", icon: "📖" },
  { href: "/viagens", label: "Viagens", icon: "✈️" },
  ...(FEATURES.lugares ? [{ href: "/lugares", label: "Lugares", icon: "📍" }] : []),
  { href: "/loja", label: "Loja", icon: "🛍️" },
  { href: "/trocas", label: "Trocas", icon: "🔄" },
];

/** Celular: barra de baixo, ao alcance do polegar (❤ Paquera no centro e "Mais" no fim). Logo, Suporte, PV, Avisos e perfil ficam no topo. */
const BOTTOM_LEFT = [
  { href: "/feed", label: "Feed", icon: "🔥" },
  { href: "/explorar", label: "Explorar", icon: "🧭" },
];
/** Pessoas (busca) fica na lupa do topo no celular. */
const BOTTOM_RIGHT = [{ href: "/salas", label: "Salas", icon: "💬" }];

/** Menu "☰" do celular: grade de atalhos com ícone, grandes para o dedo. */
const MENU = [
  { href: "/eu", label: "Meu perfil", icon: "👤" },
  { href: "/ao-vivo", label: "Ao vivo", icon: "🔴" },
  { href: "/videos", label: "Vídeos", icon: "🎬" },
  { href: "/grupos", label: "Grupos", icon: "🫂" },
  { href: "/eventos", label: "Eventos", icon: "🎉" },
  { href: "/contos", label: "Contos", icon: "📖" },
  { href: "/viagens", label: "Viagens", icon: "✈️" },
  ...(FEATURES.lugares ? [{ href: "/lugares", label: "Lugares", icon: "📍" }] : []),
  { href: "/loja", label: "Loja", icon: "🛍️" },
  { href: "/trocas", label: "Trocas", icon: "🔄" },
  { href: "/carteira", label: "Carteira", icon: "🌶️" },
  { href: "/assinar", label: "Assinar", icon: "⭐" },
];

const active = (path: string, href: string) => path === href || path.startsWith(href + "/");

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const FriendsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><path d="M18 8v6M15 11h6" />
  </svg>
);
const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
const SupportIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="10" r="3.2" />
    <path d="M6.5 19.5c.7-2.8 2.9-4.3 5.5-4.3s4.8 1.5 5.5 4.3" />
    <path d="M5 11V9.5a7 7 0 0 1 14 0V11" />
    <rect x="3.5" y="9.5" width="3" height="4.5" rx="1.2" />
    <rect x="17.5" y="9.5" width="3" height="4.5" rx="1.2" />
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
      className={`relative flex h-9 w-9 items-center justify-center rounded-full ${active(path, href) ? "bg-white/25 text-white" : "text-white/85 hover:bg-white/15 hover:text-white"}`}
    >
      {glyph}
      <Dot n={n} />
    </Link>
  );
  return (
    <div className="flex items-center gap-0.5">
      <span className="md:hidden">{icon("/pessoas", <SearchIcon />, "Buscar pessoas", 0)}</span>
      <span className="hidden lg:block">{icon("/notificacoes?aba=pedidos", <FriendsIcon />, "Pedidos de amizade", b.friends)}</span>
      <span className="md:hidden lg:block">{icon("/suporte", <SupportIcon />, "Suporte", 0)}</span>
      {icon("/mensagens", <MailIcon />, "Mensagens (PV)", b.pm)}
      {icon("/notificacoes", <BellIcon />, "Avisos", b.notif)}
      <span className="hidden lg:block">{icon("/feed#publicar", <PlusIcon />, "Publicar", 0)}</span>
    </div>
  );
}

export function MobileMenu({ admin, balance }: { admin?: boolean; balance?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = [...MENU, ...(admin ? [{ href: "/admin", label: "Admin", icon: "🛡️" }] : [])];
  const on = open || links.some((l) => active(path, l.href));
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open} className={`flex w-full flex-col items-center py-2 text-[11px] ${on ? "font-semibold text-wine" : "text-mute"}`}>
        <span className="text-xl leading-6">☰</span>
        Mais
      </button>
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
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs ${active(path, l.href) ? "border-wine2 bg-violet-50 font-semibold text-wine" : "border-line"}`}
                >
                  <span className="text-2xl">{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickExitButton className="rounded-xl border border-line py-2.5 text-sm text-mute" />
              <button onClick={() => setOpen(false)} className="btn-ghost w-full">Fechar</button>
            </div>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}

export function AppNav({ variant, admin, balance }: { variant: "top" | "bottom"; admin?: boolean; balance?: string }) {
  const path = usePathname();
  if (variant === "top") return <DesktopNav path={path} admin={admin} />;
  const item = (l: { href: string; label: string; icon: string }) => (
    <Link key={l.href} href={l.href} aria-current={active(path, l.href) ? "page" : undefined} className={`flex flex-col items-center py-2 text-[11px] ${active(path, l.href) ? "font-semibold text-wine" : "text-mute"}`}>
      <span className="text-xl leading-6">{l.icon}</span>
      {l.label}
    </Link>
  );
  const paquera = active(path, "/paquera");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navegação principal">
      {BOTTOM_LEFT.map(item)}
      {/* ❤ Paquera em destaque no centro, como no computador */}
      <Link href="/paquera" aria-label="Paquera" aria-current={paquera ? "page" : undefined} className={`flex flex-col items-center pb-2 text-[11px] ${paquera ? "font-semibold text-wine" : "text-mute"}`}>
        <span className={`-mt-4 mb-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-wine2 to-hot text-white shadow-lg ring-4 ring-ink ${paquera ? "scale-105" : ""}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3 4 6.9 4c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3C21 4 23.1 8 21.6 11.6 19.5 16.4 12 21 12 21z" /></svg>
        </span>
        Paquera
      </Link>
      {BOTTOM_RIGHT.map(item)}
      <MobileMenu admin={admin} balance={balance} />
    </nav>
  );
}

/** Topo do computador: Feed · Buscar · Vídeos · ❤ Paquera · Pessoas · Salas · Ao vivo · Mais ▾ */
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
  const item = (l: { href: string; label: string; icon: React.ReactNode }) => {
    const on = active(path, l.href);
    return (
      <Link key={l.href} href={l.href} title={l.label} aria-label={l.label} aria-current={on ? "page" : undefined}
        className={`flex w-14 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] leading-none lg:w-16 ${on ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        <Svg>{l.icon}</Svg>
        <span className={on ? "font-semibold" : ""}>{l.label}</span>
      </Link>
    );
  };
  const moreActive = more.some((l) => active(path, l.href));
  // em telas menores alguns links saem da barra e vão para o "Mais"
  const links = [
    { href: "/feed", label: "Início", cls: "" },
    { href: "/explorar", label: "Explorar", cls: "" },
    { href: "/salas", label: "Salas", cls: "hidden lg:inline-flex" },
    { href: "/paquera", label: "❤ Paquera", cls: "hidden xl:inline-flex" },
    { href: "/ao-vivo", label: "Ao vivo", cls: "hidden 2xl:inline-flex" },
    { href: "/videos", label: "Vídeos", cls: "hidden 2xl:inline-flex" },
  ];
  const overflow = [
    { href: "/salas", label: "Salas", icon: "💬", cls: "lg:hidden" },
    { href: "/suporte", label: "Suporte", icon: "🎧", cls: "lg:hidden" },
    { href: "/paquera", label: "Paquera", icon: "❤️", cls: "xl:hidden" },
    { href: "/ao-vivo", label: "Ao vivo", icon: "🔴", cls: "2xl:hidden" },
    { href: "/videos", label: "Vídeos", icon: "🎬", cls: "2xl:hidden" },
  ];
  return (
    <nav className="hidden min-w-0 items-center gap-3 md:flex xl:gap-5" aria-label="Navegação principal (computador)">
      {/* busca em pílula: abre Pessoas já com o termo */}
      <form action="/pessoas" className="relative w-40 shrink-0 lg:w-48 xl:w-60" role="search">
        <input type="hidden" name="raio" value="br" />
        <input name="q" placeholder="Encontrar pessoas" aria-label="Encontrar pessoas" className="h-9 w-full rounded-full border-0 bg-white/15 pl-9 pr-3 text-sm text-white placeholder:text-white/70 outline-none focus:bg-white/25 focus:ring-2 focus:ring-white/40" />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/80"><Svg size={16}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg></span>
      </form>
      <div className="flex shrink-0 items-center gap-0.5 xl:gap-1.5">
        {links.map((l) => {
          const on = active(path, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
              className={`${l.cls || "inline-flex"} relative whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-semibold transition ${on ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
              {l.label}
            </Link>
          );
        })}
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
            className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${moreActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
            Mais ▾
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div role="menu" className="card absolute left-0 top-11 z-50 grid w-64 grid-cols-2 gap-1 p-2 text-fg shadow-lg">
                {[...overflow, ...more.map((l) => ({ ...l, cls: "" }))].map((l) => (
                  <Link key={l.href} role="menuitem" href={l.href} className={`${l.cls} flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active(path, l.href) ? "bg-violet-50 font-semibold text-wine" : "hover:bg-black/5"}`}>
                    <span>{l.icon}</span>{l.label}
                  </Link>
                ))}
                <QuickExitButton className="col-span-2 mt-1 rounded-lg border-t border-line px-3 pt-2 text-left text-xs text-mute hover:text-fg" />
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
