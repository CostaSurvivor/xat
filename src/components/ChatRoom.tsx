"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage, OnlineUser } from "@/server/rooms";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ReportButton } from "./ReportButton";
import { CHAT_ROLES, RoleIcon, type ChatRole } from "./RoleIcon";

type Me = { id: string; nick: string };
type PollMe = { role: string; platformRole: string; mutedUntil: string | null };

const EMOJIS = ["😈", "🔥", "😍", "😘", "😏", "🍑", "🍆", "💦", "👅", "💋", "🥂", "😂", "❤️", "👀", "🙈", "👏"];
const ENTRY_FX: Record<string, string> = { sparkle: "✨", fire: "🔥", hearts: "💞", gold: "👑" };

function renderBody(body: string, myNick: string) {
  return body.split(/(@[A-Za-z0-9_.]{3,20})/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className={part.slice(1).toLowerCase() === myNick.toLowerCase() ? "rounded bg-gold/25 px-0.5 font-semibold text-gold2" : "text-gold"}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ChatRoom({ slug, me, initial }: { slug: string; me: Me; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [pollMe, setPollMe] = useState<PollMe | null>(null);
  const [pinned, setPinned] = useState<{ id: string; body: string; nick: string } | null>(null);
  const [slowMode, setSlowMode] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [selected, setSelected] = useState<OnlineUser | null>(null);
  const [sending, setSending] = useState(false);

  const lastId = useRef(initial.at(-1)?.id ?? "0");
  const lastPoll = useRef<number | null>(null);
  const typingRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const isMod = pollMe && (pollMe.role === "OWNER" || pollMe.role === "MODERATOR" || pollMe.platformRole !== "USER");

  const poll = useCallback(async () => {
    const typing = Date.now() - typingRef.current < 4000 ? "1" : "0";
    const qs = new URLSearchParams({ after: lastId.current, typing });
    if (lastPoll.current) qs.set("since", String(lastPoll.current));
    const r = await fetch(`/api/rooms/${slug}/poll?${qs}`, { cache: "no-store" });
    if (r.status === 403 || r.status === 404) {
      const j = await r.json().catch(() => ({}));
      setFatal(j.error || "Acesso negado");
      return false;
    }
    if (!r.ok) return true;
    const j = await r.json();
    lastPoll.current = j.now;
    if (j.messages.length) {
      lastId.current = j.messages.at(-1).id;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...j.messages.filter((m: ChatMessage) => !seen.has(m.id))].slice(-300);
      });
    }
    if (j.deleted.length) setMessages((prev) => prev.filter((m) => !j.deleted.includes(m.id)));
    setOnline(j.online);
    setPollMe(j.me);
    setPinned(j.pinned);
    setSlowMode(j.slowMode);
    return true;
  }, [slug]);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const ok = await poll().catch(() => true);
      if (!alive || !ok) return;
      t = setTimeout(loop, document.hidden ? 10_000 : 2000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [poll]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const r = await fetch(`/api/rooms/${slug}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    setSending(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || "Erro ao enviar");
      return;
    }
    setError(null);
    setText("");
    typingRef.current = 0;
    stick.current = true;
    poll();
  }

  async function mod(action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/rooms/${slug}/mod`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "Sem permissão");
    setSelected(null);
    poll();
  }

  const typers = online.filter((u) => u.typing).map((u) => u.nick);

  if (fatal)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-lg">{fatal}</p>
        <Link href="/salas" className="btn-gold mt-4">Ver outras salas</Link>
      </div>
    );

  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[420px] gap-3 md:h-[calc(100dvh-150px)] md:grid-cols-[1fr_260px]">
      <section className="card flex min-h-0 flex-col">
        {pinned && (
          <div className="flex items-center gap-2 border-b border-line bg-gold/10 px-3 py-1.5 text-xs text-gold2">
            📌 <b>{pinned.nick}:</b> <span className="truncate">{pinned.body}</span>
            {isMod && <button onClick={() => mod("unpin")} className="ml-auto text-mute hover:text-white">✕</button>}
          </div>
        )}
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2"
        >
          {messages.map((m) => {
            if (m.kind === "SYSTEM" && m.body.startsWith("entry:") && m.author) {
              const fx = m.body.slice(6);
              return (
                <div key={m.id} className="entry-pop my-1 rounded-xl border border-gold/30 bg-gradient-to-r from-wine/40 to-transparent px-3 py-1.5 text-sm">
                  {ENTRY_FX[fx] ?? "✨"} <Nick nick={m.author.nick} style={m.author.style} /> chegou na sala! {ENTRY_FX[fx] ?? "✨"}
                </div>
              );
            }
            if (m.kind === "SYSTEM" || m.kind === "ANNOUNCEMENT")
              return <div key={m.id} className="py-0.5 text-center text-xs italic text-mute">{m.kind === "ANNOUNCEMENT" && "📢 "}{m.body}</div>;
            if (!m.author) return null;
            const mine = m.author.id === me.id;
            return (
              <div key={m.id} className="group flex items-start gap-2 rounded-lg px-1 py-0.5 hover:bg-white/[0.03]">
                <Avatar mediaId={m.author.avatarId} nick={m.author.nick} size={28} style={m.author.style} />
                <div className="min-w-0 flex-1 text-[15px] leading-snug">
                  <span className="mr-1 inline-block align-[-2px]"><RoleIcon role={m.author.chatRole as ChatRole} size={15} /></span>
                  <Nick nick={m.author.nick} style={m.author.style} />
                  <span className="text-mute">: </span>
                  <span className="break-words" style={m.author.style?.text}>{renderBody(m.body, me.nick)}</span>
                </div>
                <div className="hidden shrink-0 gap-2 text-[11px] text-mute group-hover:flex">
                  <button onClick={() => setText((t) => `${t}@${m.author!.nick} `)}>responder</button>
                  {isMod && <button onClick={() => mod("pin", { messageId: m.id })}>fixar</button>}
                  {isMod && <button onClick={() => mod("delete_message", { messageId: m.id })} className="hover:text-red-300">apagar</button>}
                  {!mine && <ReportButton targetType="ROOM_MESSAGE" targetId={m.id} label="" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-5 px-3 text-xs italic text-mute">{typers.length > 0 && `${typers.slice(0, 3).join(", ")} ${typers.length > 1 ? "estão" : "está"} digitando…`}</div>
        {error && <div className="mx-3 mb-1 rounded-lg bg-wine/40 px-3 py-1 text-xs text-red-100">{error}</div>}
        {pollMe?.mutedUntil ? (
          <div className="border-t border-line p-3 text-center text-sm text-mute">🔇 Você está silenciado nesta sala.</div>
        ) : (
          <form onSubmit={send} className="relative flex items-center gap-2 border-t border-line p-2">
            <button type="button" onClick={() => setShowEmoji((v) => !v)} className="rounded-full px-2 text-xl">😈</button>
            {showEmoji && (
              <div className="absolute bottom-14 left-2 z-10 grid grid-cols-8 gap-1 rounded-xl border border-line bg-panel2 p-2 shadow-xl">
                {EMOJIS.map((e) => <button type="button" key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }} className="text-xl">{e}</button>)}
              </div>
            )}
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                typingRef.current = Date.now();
              }}
              maxLength={500}
              placeholder={slowMode ? `Modo lento (${slowMode}s)…` : "Digite sua mensagem…"}
              className="input flex-1"
              autoComplete="off"
            />
            <button disabled={sending || !text.trim()} className="btn-gold">Enviar</button>
            <button type="button" onClick={() => setShowUsers(true)} className="btn-ghost px-3 md:hidden">👥 {online.length}</button>
          </form>
        )}
      </section>

      <aside className={`${showUsers ? "fixed inset-0 z-50 bg-black/70 p-4" : "hidden"} md:static md:block md:bg-transparent md:p-0`} onClick={() => setShowUsers(false)}>
        <div className="card flex h-full max-h-full flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
            <b>Online ({online.length})</b>
            {isMod && (
              <select className="rounded bg-panel2 text-xs" value={slowMode} onChange={(e) => mod("set_slowmode", { seconds: Number(e.target.value) })}>
                {[0, 5, 10, 30, 60].map((s) => <option key={s} value={s}>{s ? `lento ${s}s` : "sem modo lento"}</option>)}
              </select>
            )}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {online.map((u) => (
              <li key={u.id}>
                <button onClick={() => setSelected(u)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 ${u.highlight ? "bg-gradient-to-r from-gold/20 to-transparent" : ""}`}>
                  <RoleIcon role={u.chatRole as ChatRole} size={18} />
                  <Avatar mediaId={u.avatarId} nick={u.nick} size={24} style={u.style} />
                  <span className="min-w-0 flex-1 truncate"><Nick nick={u.nick} style={u.style} link={false} /></span>
                  {u.invisible && <span title="Invisível">👻</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-mute">
            {(Object.keys(CHAT_ROLES) as ChatRole[]).map((r) => (
              <span key={r} className="flex items-center gap-1"><RoleIcon role={r} size={13} />{CHAT_ROLES[r].label}</span>
            ))}
          </div>
        </div>
      </aside>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-xs space-y-2 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Avatar mediaId={selected.avatarId} nick={selected.nick} size={48} style={selected.style} />
              <div>
                <Nick nick={selected.nick} style={selected.style} />
                <div className="flex items-center gap-1 text-xs text-mute"><RoleIcon role={selected.chatRole as ChatRole} size={13} />{CHAT_ROLES[selected.chatRole as ChatRole].label}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/u/${selected.nick}`} className="btn-ghost">Perfil</Link>
              {selected.id !== me.id && <Link href={`/mensagens/${selected.nick}`} className="btn-wine">PV</Link>}
            </div>
            {isMod && selected.id !== me.id && (
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
                <button onClick={() => mod("mute", { targetUserId: selected.id, minutes: 10 })} className="btn-ghost">Silenciar 10m</button>
                <button onClick={() => mod("mute", { targetUserId: selected.id, minutes: 60 })} className="btn-ghost">Silenciar 1h</button>
                <button onClick={() => mod("kick", { targetUserId: selected.id })} className="btn-ghost">Expulsar</button>
                <button onClick={() => mod("ban", { targetUserId: selected.id, minutes: 60 * 24 })} className="btn-ghost">Banir 24h</button>
                <button onClick={() => confirm(`Banir ${selected.nick} permanentemente?`) && mod("ban", { targetUserId: selected.id })} className="btn-wine col-span-2">Banir permanente</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
