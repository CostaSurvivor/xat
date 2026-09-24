"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { InboxItem } from "@/server/pm";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";

function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now.getTime() - 86400_000);
  if (d.toDateString() === y.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Lista de conversas (coluna esquerda), atualiza sozinha. */
export function Inbox({ initial }: { initial: InboxItem[] }) {
  const [list, setList] = useState(initial);
  const [q, setQ] = useState("");
  const path = usePathname();
  const active = decodeURIComponent(path.split("/mensagens/")[1] ?? "");
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/pm/inbox", { cache: "no-store" }).then((r) => r.json()).then((j) => alive && j.list && setList(j.list)).catch(() => {});
    const t = setInterval(load, document.hidden ? 20_000 : 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    // abrir uma conversa zera a bolinha dela
    setList((l) => l.map((c) => (c.other.nick === active ? { ...c, unread: false } : c)));
  }, [active]);
  const shown = list.filter((c) => !q || c.other.nick.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className={`${active ? "hidden md:flex" : "flex"} card min-h-0 flex-col overflow-hidden`}>
      <div className="border-b border-line p-3">
        <h1 className="mb-2 font-[family-name:var(--font-display)] text-xl font-bold">Conversas</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar conversa" className="input py-1.5" />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <li className="p-6 text-center text-sm text-mute">
            {list.length === 0 ? <>Nenhuma conversa ainda. Encontre gente em <Link href="/pessoas" className="text-gold underline">Pessoas</Link> ou nas <Link href="/salas" className="text-gold underline">Salas</Link>.</> : "Nada encontrado."}
          </li>
        )}
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={`/mensagens/${encodeURIComponent(c.other.nick)}`}
              className={`flex items-center gap-3 border-b border-line/60 px-3 py-2.5 hover:bg-white/5 ${c.other.nick === active ? "bg-wine/30" : ""} ${c.unread && c.priority ? "bg-gold/10" : ""}`}
            >
              <span className="relative">
                <Avatar mediaId={c.other.avatarId} nick={c.other.nick} size={48} style={c.other.style} />
                {c.other.online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-panel bg-green-500" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate"><Nick nick={c.other.nick} style={c.other.style} link={false} /></span>
                  <span className={`shrink-0 text-[11px] ${c.unread ? "text-gold" : "text-mute"}`}>{when(c.lastAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${c.unread ? "font-semibold text-white" : "text-mute"}`}>
                    {c.lastMine && <span className="text-mute">Você: </span>}
                    {c.priority && c.unread && "⚡ "}
                    {c.last}
                  </p>
                  {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
