"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dot, useBadges } from "./Badges";

const LINKS = [
  { href: "/feed", label: "Feed", icon: "🔥" },
  { href: "/salas", label: "Salas", icon: "💬" },
  { href: "/pessoas", label: "Pessoas", icon: "👥" },
  { href: "/mensagens", label: "PV", icon: "✉️", badge: "pm" as const },
  { href: "/notificacoes", label: "Avisos", icon: "🔔", badge: "notif" as const },
];

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const b = useBadges();
  if (variant === "top")
    return (
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`relative rounded-full px-3 py-1.5 text-sm ${path.startsWith(l.href) ? "bg-wine/50 text-white" : "text-mute hover:text-white"}`}>
            {l.label}
            {l.badge && <Dot n={b[l.badge]} />}
          </Link>
        ))}
      </nav>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`flex flex-col items-center py-2 text-[11px] ${path.startsWith(l.href) ? "text-gold" : "text-mute"}`}>
          <span className="relative text-lg">{l.icon}{l.badge && <Dot n={b[l.badge]} />}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
