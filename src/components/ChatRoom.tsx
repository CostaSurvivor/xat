"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage, OfflineUser, OnlineUser } from "@/server/rooms";
import type { PmMessage } from "@/server/pm";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ReportButton } from "./ReportButton";
import { CHAT_ROLES, RoleIcon, type ChatRole } from "./RoleIcon";
import { sendCoins } from "@/app/actions/shop";
import { sendFriendRequest, toggleBlock } from "@/app/actions/profile";
import { startTrade } from "@/app/actions/trade";
import { CURRENCY_ICON, CURRENCY_NAME, PROFILE_TYPES, REACTIONS } from "@/lib/config";

type Me = { id: string; nick: string };
type PollMe = { role: string; platformRole: string; mutedUntil: string | null; canPinOwn?: boolean };
type ListUser = (OnlineUser | OfflineUser) & { offline?: boolean };

const EMOJIS = ["😈", "🔥", "😍", "😘", "😏", "🍑", "🍆", "💦", "👅", "💋", "🥂", "😂", "❤️", "👀", "🙈", "👏", "🤤", "🥵", "😜", "🍷", "🌶️", "💃", "🕺", "🤫"];
const ENTRY_FX: Record<string, string> = { sparkle: "✨", fire: "🔥", hearts: "💞", gold: "👑" };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function renderBody(body: string, myNick: string) {
  return body.split(/(@[A-Za-z0-9_.]{3,20})/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className={part.slice(1).toLowerCase() === myNick.toLowerCase() ? "rounded bg-gold/25 px-0.5 font-semibold text-gold2" : "text-gold"}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Som curto gerado no navegador (entrada na sala / PC novo). */
function beep(fx: string) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = fx === "fire" ? [330, 440, 660] : fx === "gold" ? [523, 659, 784, 1046] : fx === "hearts" ? [587, 740, 880] : fx === "pc" ? [880, 660] : [660, 880, 1320];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = fx === "fire" ? "sawtooth" : "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

/** Conversa privada (PC) dentro da sala, estilo xat. Usa o mesmo PV do site. */
function PcPane({ nick, meNick }: { nick: string; meNick: string }) {
  const [msgs, setMsgs] = useState<PmMessage[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const last = useRef("0");
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/pm/${encodeURIComponent(nick)}?after=${last.current}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (j.messages?.length) {
      last.current = j.messages.at(-1).id;
      setMsgs((p) => [...p, ...j.messages.filter((m: PmMessage) => !p.some((x) => x.id === m.id))]);
    }
  }, [nick]);
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await fetch(`/api/pm/${encodeURIComponent(nick)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Erro");
    setErr(null);
    setText("");
    load();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={box} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="py-1 text-center text-[11px] text-mute">Conversa privada com @{nick} · só vocês dois veem · <Link href={`/mensagens/${nick}`} className="underline">abrir no PV completo</Link></p>
        {msgs.map((m) => (
          <div key={m.id} className="text-[15px] leading-snug">
            <span className="mr-1 text-[11px] text-mute">{hhmm(m.createdAt)}</span>
            <b className={m.mine ? "text-gold2" : "text-pink-700"}>{m.mine ? meNick : nick}</b>
            <span className="text-mute">: </span>
            {m.mediaId ? <Link href={`/mensagens/${nick}`} className="text-gold underline">📷 foto (abrir no PV)</Link> : <span className="break-words">{m.body}</span>}
          </div>
        ))}
      </div>
      {err && <div className="mx-3 mb-1 rounded-lg bg-wine/40 px-3 py-1 text-xs text-red-800">{err}</div>}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={`Mensagem privada para ${nick}…`} className="input flex-1" autoComplete="off" />
        <button disabled={!text.trim()} className="btn-gold">Enviar</button>
      </form>
    </div>
  );
}

export function ChatRoom({ slug, me, initial }: { slug: string; me: Me; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [offline, setOffline] = useState<OfflineUser[]>([]);
  const [showOffline, setShowOffline] = useState(false);
  const [pollMe, setPollMe] = useState<PollMe | null>(null);
  const [pinned, setPinned] = useState<{ id: string; body: string; nick: string } | null>(null);
  const [slowMode, setSlowMode] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [selected, setSelected] = useState<ListUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { e: Record<string, number>; mine: string | null }>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(initial.length >= 50);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [muted, setMuted] = useState(false);
  // abas estilo xat: "sala" + uma aba de PC por pessoa
  const [tabs, setTabs] = useState<{ nick: string; unread: number }[]>([]);
  const [active, setActive] = useState<string>("sala");
  const activeRef = useRef("sala");
  const mutedRef = useRef(false);
  const seenPm = useRef<Record<string, string>>({});
  const startedAt = useRef(Date.now());

  useEffect(() => {
    try { const v = localStorage.getItem("chat-muted") === "1"; setMuted(v); mutedRef.current = v; } catch {}
  }, []);
  useEffect(() => { activeRef.current = active; }, [active]);

  const chime = useCallback((fx: string) => { if (!mutedRef.current) beep(fx); }, []);

  const lastId = useRef(initial.at(-1)?.id ?? "0");
  const lastPoll = useRef<number | null>(null);
  const typingRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const isMod = pollMe && (pollMe.role === "OWNER" || pollMe.role === "MODERATOR" || pollMe.platformRole !== "USER");

  const openPc = useCallback((nick: string, focus = true) => {
    setTabs((t) => (t.some((x) => x.nick === nick) ? t : [...t, { nick, unread: 0 }]));
    if (focus) {
      setActive(nick);
      setTabs((t) => t.map((x) => (x.nick === nick ? { ...x, unread: 0 } : x)));
    }
  }, []);

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
    const first = lastPoll.current === null;
    lastPoll.current = j.now;
    if (j.messages.length) {
      const entry = j.messages.find((m: ChatMessage) => m.kind === "SYSTEM" && m.body.startsWith("entry:"));
      if (entry && !first) chime(entry.body.slice(6));
      lastId.current = j.messages.at(-1).id;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...j.messages.filter((m: ChatMessage) => !seen.has(m.id))].slice(-300);
      });
    }
    if (j.deleted.length) setMessages((prev) => prev.filter((m) => !j.deleted.includes(m.id)));
    setOnline(j.online);
    setOffline(j.offline ?? []);
    if (j.reactions) setReactions(j.reactions);
    setPollMe(j.me);
    setPinned(j.pinned);
    setSlowMode(j.slowMode);
    return true;
  }, [slug, chime]);

  // PCs recebidos: abre a aba sozinha (como no xat) e marca não lidas
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const r = await fetch("/api/pm/inbox", { cache: "no-store" }).catch(() => null);
      if (!r?.ok || !alive) return;
      const { list } = (await r.json()) as { list: { other: { nick: string }; unread: boolean; lastAt: string; lastMine: boolean }[] };
      for (const c of list) {
        if (!c.unread || c.lastMine) continue;
        if (new Date(c.lastAt).getTime() < startedAt.current - 60_000) continue;
        if (seenPm.current[c.other.nick] === c.lastAt) continue;
        seenPm.current[c.other.nick] = c.lastAt;
        const nick = c.other.nick;
        setTabs((t) => {
          const has = t.find((x) => x.nick === nick);
          if (activeRef.current === nick) return t;
          return has ? t.map((x) => (x.nick === nick ? { ...x, unread: x.unread + 1 } : x)) : [...t, { nick, unread: 1 }];
        });
        if (activeRef.current !== nick) chime("pc");
      }
    };
    check();
    const t = setInterval(check, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [chime]);

  async function loadOlder() {
    const first = messages.find((m) => /^\d+$/.test(m.id));
    if (!first) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const r = await fetch(`/api/rooms/${slug}/history?before=${first.id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({ messages: [] }));
    setLoadingOlder(false);
    if (!j.messages?.length) return setHasOlder(false);
    stick.current = false;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...j.messages.filter((m: ChatMessage) => !seen.has(m.id)), ...prev];
    });
    if (j.messages.length < 50) setHasOlder(false);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
  }

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
    if (el && stick.current && active === "sala") el.scrollTop = el.scrollHeight;
  }, [messages, active]);

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

  async function pinOwn(messageId: string) {
    const r = await fetch(`/api/rooms/${slug}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "Não foi possível fixar");
    poll();
  }

  async function react(messageId: string, emoji: string) {
    setPickerFor(null);
    setReactions((prev) => {
      const cur = prev[messageId] ?? { e: {}, mine: null };
      const e = { ...cur.e };
      if (cur.mine) e[cur.mine] = Math.max(0, (e[cur.mine] ?? 1) - 1);
      const mine = cur.mine === emoji ? null : emoji;
      if (mine) e[mine] = (e[mine] ?? 0) + 1;
      return { ...prev, [messageId]: { e, mine } };
    });
    await fetch(`/api/rooms/${slug}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, emoji }) });
  }

  const typers = online.filter((u) => u.typing).map((u) => u.nick);
  const noPcUnread = tabs.reduce((s, t) => s + t.unread, 0);

  if (fatal)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-lg">{fatal}</p>
        <Link href="/salas" className="btn-gold mt-4">Ver outras salas</Link>
      </div>
    );

  const UserRow = ({ u, off = false }: { u: ListUser; off?: boolean }) => (
    <li>
      <button
        onClick={() => setSelected({ ...u, offline: off })}
        className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-black/5 ${"highlight" in u && u.highlight ? "bg-gradient-to-r from-gold/20 to-transparent" : ""} ${off ? "opacity-60" : ""}`}
      >
        <RoleIcon role={u.chatRole as ChatRole} size={26} vip={u.style?.vip} accessory={u.style?.doll} offline={off} />
        <Avatar mediaId={u.avatarId} nick={u.nick} size={28} style={u.style} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm"><Nick nick={u.nick} style={u.style} link={false} /></span>
          {u.statusText && <span className="block truncate text-[11px] italic text-mute">{u.statusText}</span>}
        </span>
        {"invisible" in u && u.invisible && <span title="Invisível">👻</span>}
        {"typing" in u && u.typing && <span className="text-xs text-mute" title="digitando">✍️</span>}
      </button>
    </li>
  );

  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[440px] gap-3 md:h-[calc(100dvh-150px)] md:grid-cols-[1fr_280px]">
      <section className="card flex min-h-0 flex-col overflow-hidden bg-panel/85 backdrop-blur">
        {/* abas (sala + conversas privadas) */}
        <div className="flex items-end gap-1 overflow-x-auto border-b border-line bg-ink/60 px-2 pt-1.5">
          <button onClick={() => setActive("sala")} className={`shrink-0 rounded-t-lg px-3 py-1.5 text-sm ${active === "sala" ? "bg-panel font-semibold text-gold" : "text-mute hover:text-fg"}`}>💬 Sala</button>
          {tabs.map((t) => (
            <span key={t.nick} className={`flex shrink-0 items-center rounded-t-lg ${active === t.nick ? "bg-panel" : ""}`}>
              <button
                onClick={() => { setActive(t.nick); setTabs((x) => x.map((y) => (y.nick === t.nick ? { ...y, unread: 0 } : y))); }}
                className={`py-1.5 pl-3 pr-1 text-sm ${active === t.nick ? "font-semibold text-pink-700" : "text-mute hover:text-fg"} ${t.unread ? "animate-pulse text-pink-700" : ""}`}
              >
                🔒 {t.nick}{t.unread ? <span className="ml-1 rounded-full bg-wine2 px-1.5 text-[10px] text-white">{t.unread}</span> : null}
              </button>
              <button onClick={() => { setTabs((x) => x.filter((y) => y.nick !== t.nick)); if (active === t.nick) setActive("sala"); }} className="px-1.5 text-xs text-mute hover:text-fg" aria-label="Fechar">✕</button>
            </span>
          ))}
          <span className="ml-auto flex shrink-0 items-center gap-2 pb-1 text-xs text-mute">
            {noPcUnread > 0 && active === "sala" && <span className="text-pink-700">{noPcUnread} PC nova(s)</span>}
            <button
              onClick={() => { const v = !muted; setMuted(v); mutedRef.current = v; try { localStorage.setItem("chat-muted", v ? "1" : "0"); } catch {} }}
              title={muted ? "Ativar sons" : "Silenciar sons"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </span>
        </div>

        {active !== "sala" ? (
          <PcPane key={active} nick={active} meNick={me.nick} />
        ) : (
          <>
            {pinned && (
              <div className="flex items-center gap-2 border-b border-line bg-gold/10 px-3 py-1.5 text-xs text-gold2">
                📌 <b>{pinned.nick}:</b> <span className="truncate">{pinned.body}</span>
                {isMod && <button onClick={() => mod("unpin")} className="ml-auto text-mute hover:text-fg">✕</button>}
              </div>
            )}
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
            >
              {hasOlder && (
                <div className="py-1 text-center">
                  <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost py-1 text-xs">{loadingOlder ? "Carregando…" : "↑ Carregar mensagens anteriores"}</button>
                </div>
              )}
              {messages.map((m) => {
                if (m.kind === "SYSTEM" && m.body.startsWith("entry:") && m.author) {
                  const fx = m.body.slice(6);
                  return (
                    <div key={m.id} className="entry-pop my-1 rounded-xl border border-gold/30 bg-gradient-to-r from-wine/40 to-transparent px-3 py-1.5 text-sm">
                      {ENTRY_FX[fx] ?? "✨"} <Nick nick={m.author.nick} style={m.author.style} /> chegou na sala! {ENTRY_FX[fx] ?? "✨"}
                    </div>
                  );
                }
                if (m.kind === "SYSTEM" && m.body.startsWith("pin:")) {
                  return m.author ? <div key={m.id} className="py-0.5 text-center text-xs text-gold">📌 <Nick nick={m.author.nick} style={m.author.style} /> fixou uma mensagem no topo</div> : null;
                }
                if (m.kind === "GIFT" && m.author) {
                  const [amount, toNick] = m.body.split("|");
                  return (
                    <div key={m.id} className="entry-pop my-1 flex items-center gap-2 rounded-xl border border-gold/40 bg-gradient-to-r from-gold/20 via-wine/30 to-transparent px-3 py-2 text-sm">
                      <span className="text-2xl">🎁</span>
                      <span><Nick nick={m.author.nick} style={m.author.style} /> presenteou <b className="text-gold2">@{toNick}</b> com <b className="text-gold">{CURRENCY_ICON} {amount} {CURRENCY_NAME}</b>!</span>
                      <span className="ml-auto animate-bounce text-xl">✨</span>
                    </div>
                  );
                }
                if (m.kind === "SYSTEM" || m.kind === "ANNOUNCEMENT")
                  return <div key={m.id} className="py-0.5 text-center text-xs italic text-mute">{m.kind === "ANNOUNCEMENT" && "📢 "}{m.body}</div>;
                if (!m.author) return null;
                const mine = m.author.id === me.id;
                return (
                  <div key={m.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.04]">
                    <button onClick={() => { const u = online.find((x) => x.id === m.author!.id) ?? offline.find((x) => x.id === m.author!.id); if (u) setSelected(u); }} className="shrink-0">
                      <Avatar mediaId={m.author.avatarId} nick={m.author.nick} size={32} style={m.author.style} />
                    </button>
                    <div className="min-w-0 flex-1 text-[15px] leading-snug">
                      <span className="mr-1 inline-block align-[-5px]"><RoleIcon role={m.author.chatRole as ChatRole} size={22} vip={m.author.style?.vip} accessory={m.author.style?.doll} /></span>
                      <Nick nick={m.author.nick} style={m.author.style} />
                      <span className="text-mute">: </span>
                      <span className="break-words" style={m.author.style?.text}>{renderBody(m.body, me.nick)}</span>
                      {reactions[m.id] && Object.values(reactions[m.id].e).some((n) => n > 0) && (
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {Object.entries(reactions[m.id].e).filter(([, n]) => n > 0).map(([e, n]) => (
                            <button key={e} onClick={() => react(m.id, e)} className={`rounded-full border px-1.5 text-xs ${reactions[m.id].mine === e ? "border-gold bg-gold/15" : "border-line"}`}>{e} {n}</button>
                          ))}
                        </span>
                      )}
                      {pickerFor === m.id && (
                        <span className="ml-2 inline-flex gap-1 rounded-full border border-line bg-panel2 px-2 align-middle">
                          {REACTIONS.map((e) => <button key={e} onClick={() => react(m.id, e)} className="text-base hover:scale-125">{e}</button>)}
                        </span>
                      )}
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 text-[11px] text-mute group-hover:flex">
                      <span>{hhmm(m.createdAt)}</span>
                      <button onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>reagir</button>
                      <button onClick={() => setText((t) => `${t}@${m.author!.nick} `)}>responder</button>
                      {isMod ? <button onClick={() => mod("pin", { messageId: m.id })}>fixar</button> : mine && pollMe?.canPinOwn && <button onClick={() => pinOwn(m.id)} title="Poder: fixar mensagem">📌 fixar</button>}
                      {isMod && <button onClick={() => mod("delete_message", { messageId: m.id })} className="hover:text-red-700">apagar</button>}
                      {!mine && <ReportButton targetType="ROOM_MESSAGE" targetId={m.id} label="" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="h-5 px-3 text-xs italic text-mute">{typers.length > 0 && `${typers.slice(0, 3).join(", ")} ${typers.length > 1 ? "estão" : "está"} digitando…`}</div>
            {error && <div className="mx-3 mb-1 rounded-lg bg-wine/40 px-3 py-1 text-xs text-red-800">{error}</div>}
            {pollMe?.mutedUntil ? (
              <div className="border-t border-line p-3 text-center text-sm text-mute">🔇 Você está silenciado nesta sala.</div>
            ) : (
              <form onSubmit={send} className="relative flex items-center gap-2 border-t border-line bg-ink/40 p-2">
                <button type="button" onClick={() => setShowEmoji((v) => !v)} className="rounded-full px-2 text-xl" title="Emojis">😈</button>
                {showEmoji && (
                  <div className="absolute bottom-14 left-2 z-10 grid grid-cols-8 gap-1 rounded-xl border border-line bg-panel2 p-2 shadow-xl">
                    {EMOJIS.map((e) => <button type="button" key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }} className="text-xl hover:scale-125">{e}</button>)}
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
          </>
        )}
      </section>

      <aside className={`${showUsers ? "fixed inset-0 z-50 bg-black/70 p-4" : "hidden"} md:static md:block md:bg-transparent md:p-0`} onClick={() => setShowUsers(false)}>
        <div className="card flex h-full max-h-full flex-col overflow-hidden bg-panel/85 backdrop-blur" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-line bg-ink/60 px-3 py-2 text-sm">
            <b className="text-green-700">● Online ({online.length})</b>
            {isMod && (
              <select className="rounded bg-panel2 text-xs" value={slowMode} onChange={(e) => mod("set_slowmode", { seconds: Number(e.target.value) })}>
                {[0, 5, 10, 30, 60].map((s) => <option key={s} value={s}>{s ? `lento ${s}s` : "sem modo lento"}</option>)}
              </select>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            <ul>{online.map((u) => <UserRow key={u.id} u={u} />)}</ul>
            {offline.length > 0 && (
              <>
                <button onClick={() => setShowOffline((v) => !v)} className="mt-2 flex w-full items-center justify-between border-t border-line px-2 pt-2 text-xs text-mute">
                  <span className="text-red-700">● Offline ({offline.length})</span>
                  <span>{showOffline ? "▲" : "▼"}</span>
                </button>
                {showOffline && <ul>{offline.map((u) => <UserRow key={u.id} u={u} off />)}</ul>}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-mute">
            {(Object.keys(CHAT_ROLES) as ChatRole[]).map((r) => (
              <span key={r} className="flex items-center gap-1"><RoleIcon role={r} size={14} />{CHAT_ROLES[r].label}</span>
            ))}
            <span className="flex items-center gap-1"><RoleIcon role="GUEST" vip size={14} />Assinante</span>
            <span className="flex items-center gap-1"><RoleIcon role="GUEST" offline size={14} />Offline</span>
          </div>
        </div>
      </aside>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => { setSelected(null); setNotice(null); }}>
          <div className="card w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* cabeçalho do mini-perfil (estilo xat) */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-wine/60 to-panel p-4">
              <Avatar mediaId={selected.avatarId} nick={selected.nick} size={72} style={selected.style} />
              <div className="min-w-0">
                <div className="text-lg"><Nick nick={selected.nick} style={selected.style} link={false} /></div>
                {selected.statusText && <p className="truncate text-xs italic text-fg/70">“{selected.statusText}”</p>}
                <div className="mt-1 flex items-center gap-1 text-xs text-mute">
                  <RoleIcon role={selected.chatRole as ChatRole} size={18} vip={selected.style?.vip} accessory={selected.style?.doll} offline={selected.offline} />
                  {CHAT_ROLES[selected.chatRole as ChatRole].label}
                  {selected.style?.vip ? " · Assinante" : ""}
                  {selected.offline ? " · offline" : " · online"}
                </div>
                <p className="text-xs text-mute">{PROFILE_TYPES[selected.profileType as keyof typeof PROFILE_TYPES]?.label}{"city" in selected && selected.city ? ` · ${selected.city}` : ""}</p>
              </div>
            </div>
            <div className="space-y-2 p-4">
              {selected.id !== me.id ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button onClick={() => { openPc(selected.nick); setSelected(null); }} className="btn-wine flex-col py-2">💬<span>PC</span></button>
                  <Link href={`/u/${selected.nick}`} className="btn-ghost flex-col py-2">👤<span>Perfil</span></Link>
                  <button onClick={async () => { await sendFriendRequest(selected.id); setNotice("Pedido de amizade enviado! 🤝"); }} className="btn-ghost flex-col py-2">🤝<span>Amizade</span></button>
                  <form action={startTrade.bind(null, selected.nick)} className="contents"><button className="btn-ghost flex-col py-2">🔄<span>Trocar</span></button></form>
                  <button onClick={() => confirm(`Bloquear ${selected.nick}? Vocês deixam de se ver nas salas e no PV.`) && toggleBlock(selected.id).then(() => { setSelected(null); poll(); })} className="btn-ghost flex-col py-2">🚫<span>Bloquear</span></button>
                  <span className="btn-ghost flex-col py-2"><ReportButton targetType="USER" targetId={selected.id} label="Denunciar" /></span>
                </div>
              ) : (
                <Link href="/perfil" className="btn-ghost w-full">Editar meu perfil e status</Link>
              )}
              {notice && <p className="text-center text-xs text-gold">{notice}</p>}
              {selected.id !== me.id && (
                <div className="border-t border-line pt-2">
                  <p className="mb-1 text-xs text-mute">🎁 Presentear na sala</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 50, 100, 500].map((v) => (
                      <button
                        key={v}
                        onClick={async () => {
                          const r = await sendCoins(selected.id, v, crypto.randomUUID(), slug);
                          setError(r.ok ? null : r.error ?? "Erro");
                          setSelected(null);
                          poll();
                        }}
                        className="rounded-lg border border-gold/40 py-1 text-xs text-gold hover:bg-gold/10"
                      >
                        {CURRENCY_ICON}{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isMod && selected.id !== me.id && (
                <div className="grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
                  {!selected.offline && <button onClick={() => mod("mute", { targetUserId: selected.id, minutes: 10 })} className="btn-ghost">Silenciar 10m</button>}
                  {!selected.offline && <button onClick={() => mod("mute", { targetUserId: selected.id, minutes: 60 })} className="btn-ghost">Silenciar 1h</button>}
                  {!selected.offline && <button onClick={() => mod("kick", { targetUserId: selected.id })} className="btn-ghost">Expulsar</button>}
                  <button onClick={() => mod("ban", { targetUserId: selected.id, minutes: 60 * 24 })} className="btn-ghost">Banir 24h</button>
                  <button onClick={() => confirm(`Banir ${selected.nick} permanentemente?`) && mod("ban", { targetUserId: selected.id })} className="btn-wine col-span-2">Banir permanente</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
