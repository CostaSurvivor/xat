"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { InboxItem } from "@/server/pm";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { INBOX_FILTERS, INBOX_TABS, applyInbox, tabOf, unreadByTab, type InboxFilter, type InboxTab } from "@/lib/inbox";

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
  // abre em "Novos contatos" só quando não há nenhuma conversa ainda
  const [tab, setTab] = useState<InboxTab>(() => (initial.length > 0 && initial.every((c) => tabOf(c) === "novos") ? "novos" : "conversas"));
  const [filter, setFilter] = useState<InboxFilter>("todas");
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
  const shown = applyInbox(list, tab, filter, q);
  const unread = unreadByTab(list);
  return (
    <aside className={`${active ? "hidden md:flex" : "flex"} card min-h-0 flex-col overflow-hidden`}>
      <div className="border-b border-line p-3">
        <h1 className="sr-only">Mensagens</h1>
        <div className="mb-2 grid grid-cols-2 rounded-xl bg-panel2 p-1 text-sm" role="tablist">
          {(Object.keys(INBOX_TABS) as InboxTab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`aba-${t}`}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold ${tab === t ? "bg-panel text-fg shadow-sm" : "text-mute"}`}>
              {INBOX_TABS[t]}
              {unread[t] > 0 && <span className="rounded-full bg-wine px-1.5 text-[11px] font-bold text-white">{unread[t]}</span>}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar conversa" className="input py-1.5" />
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" data-testid="filtros-pv">
          {(Object.keys(INBOX_FILTERS) as InboxFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${filter === f ? "border-wine bg-wine text-white" : "border-line text-mute hover:border-wine"}`}>
              {INBOX_FILTERS[f]}
            </button>
          ))}
        </div>
        {tab === "novos" && <p className="mt-2 text-[11px] text-mute">Quem escreveu para você e ainda não teve resposta. Respondeu, a conversa vai para “Conversas”.</p>}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <li className="p-6 text-center text-sm text-mute">
            {list.length === 0 ? <>Nenhuma conversa ainda. Encontre gente em <Link href="/pessoas" className="text-gold underline">Pessoas</Link> ou nas <Link href="/salas" className="text-gold underline">Salas</Link>.</> : tab === "novos" && filter === "todas" && !q ? "Nenhum contato novo esperando resposta." : "Nada encontrado."}
          </li>
        )}
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={`/mensagens/${encodeURIComponent(c.other.nick)}`}
              className={`flex items-center gap-3 border-b border-line/60 px-3 py-2.5 hover:bg-black/5 ${c.other.nick === active ? "bg-violet-50" : ""} ${c.unread && c.priority ? "bg-gold/10" : ""}`}
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
                  <p className={`min-w-0 flex-1 truncate text-sm ${c.unread ? "font-semibold text-fg" : "text-mute"}`}>
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
