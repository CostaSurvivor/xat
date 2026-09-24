"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { revealPmPhoto, sendPmPhoto } from "@/app/actions/pm";
import type { PmMessage } from "@/server/pm";
import { ProtectedImage } from "./ProtectedImage";
import { ReportButton } from "./ReportButton";

export function PmThread({ nick, initial, canPhoto, blockedReason }: { nick: string; initial: PmMessage[]; canPhoto: string | null; blockedReason: string | null }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const last = useRef(initial.at(-1)?.id ?? "0");
  const box = useRef<HTMLDivElement>(null);

  async function poll() {
    const r = await fetch(`/api/pm/${encodeURIComponent(nick)}?after=${last.current}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (j.messages.length) {
      last.current = j.messages.at(-1).id;
      setMsgs((p) => {
        const seen = new Set(p.map((m) => m.id));
        return [...p, ...j.messages.filter((m: PmMessage) => !seen.has(m.id))];
      });
    }
  }
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await poll().catch(() => {});
      if (alive) t = setTimeout(loop, document.hidden ? 15_000 : 3000);
    };
    loop();
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nick]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await fetch(`/api/pm/${encodeURIComponent(nick)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Erro");
    setErr(null);
    setText("");
    poll();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f4eff1]">
      <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="mt-10 text-center text-sm text-mute">Diga oi! 👋 Seja gentil: respeito é a regra número um.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`group flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] ${m.mine ? "rounded-br-sm bg-pink-100" : "rounded-bl-sm border border-line bg-panel"}`}>
              {m.mediaId && (
                <ProtectedImage
                  id={m.mediaId}
                  reveal={!m.mine && !m.revealed}
                  bust={m.revealed || m.mine ? "r" : undefined}
                  onReveal={() => revealPmPhoto(m.id)}
                  className="mb-1 aspect-square w-60 rounded-xl"
                />
              )}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg/50">
                {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {!m.mine && <ReportButton targetType="PRIVATE_MESSAGE" targetId={m.id} label="" className="hidden group-hover:inline" />}
              </div>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="px-3 text-xs text-red-700">{err}</p>}
      {blockedReason ? (
        <p className="border-t border-line p-3 text-center text-sm text-mute">{blockedReason}</p>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-2">
          <label title={canPhoto ?? "Enviar foto"} className={`rounded-full px-2 text-xl ${canPhoto ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
            📷
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={!!canPhoto || pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("photo", f);
                start(async () => {
                  const r = await sendPmPhoto(nick, fd);
                  if (!r.ok) setErr(r.error ?? "Erro");
                  else { setErr(null); poll(); }
                });
                e.target.value = "";
              }}
            />
          </label>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={pending ? "Enviando foto…" : "Mensagem…"} className="input flex-1" />
          <button className="btn-gold">Enviar</button>
        </form>
      )}
      {canPhoto && !blockedReason && <p className="px-3 pb-2 text-[11px] text-mute">📷 {canPhoto}</p>}
    </div>
  );
}
