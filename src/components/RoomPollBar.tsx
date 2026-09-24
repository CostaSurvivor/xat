"use client";

import { useEffect, useState } from "react";
import { ROOM_POLL } from "@/lib/roompolls";

export type RoomPollView = {
  id: string;
  question: string;
  options: string[];
  counts: number[];
  pct: number[];
  total: number;
  winners: number[];
  mine: number | null;
  open: boolean;
  endsAt: string;
};

function left(endsAt: string) {
  const s = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`;
}

/** Enquete no topo da sala: vota com um toque; resultado aparece depois de votar (ou para moderadores). */
export function RoomPollBar({ slug, poll, isMod, onChange }: { slug: string; poll: RoomPollView | null; isMod: boolean; onChange: () => void }) {
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [minutes, setMinutes] = useState(5);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!poll?.open) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [poll?.open]);

  const call = async (method: string, body: object) => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/rooms/${slug}/enquete`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.error ?? "Erro");
    onChange();
    return r.ok;
  };

  const showResults = poll && (poll.mine !== null || !poll.open || isMod);

  return (
    <>
      {poll && (
        <div className="border-b border-line bg-pink-50/70 px-3 py-2 text-sm" data-testid="room-poll">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <b className="min-w-0 flex-1">📊 {poll.question}</b>
            <span className="text-xs text-mute">{poll.open ? `termina em ${left(poll.endsAt)}` : "encerrada"} · {poll.total} {poll.total === 1 ? "voto" : "votos"}</span>
            {isMod && poll.open && <button disabled={busy} onClick={() => call("DELETE", { pollId: poll.id })} className="text-xs text-red-700 hover:underline">Encerrar</button>}
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {poll.options.map((o, i) => {
              const win = poll.winners.includes(i);
              return (
                <button
                  key={i}
                  disabled={!poll.open || busy}
                  onClick={() => call("PUT", { pollId: poll.id, option: i })}
                  className={`relative overflow-hidden rounded-lg border px-2 py-1 text-left text-sm ${poll.mine === i ? "border-wine2" : "border-line"} ${poll.open ? "hover:border-wine2" : ""} bg-white`}
                >
                  {showResults && <span className={`absolute inset-y-0 left-0 ${win ? "bg-amber-200" : "bg-pink-100"}`} style={{ width: `${poll.pct[i]}%` }} />}
                  <span className="relative flex gap-2">
                    <span className="min-w-0 flex-1 truncate">{poll.mine === i && "✓ "}{win && "🏆 "}{o}</span>
                    {showResults && <span className="text-xs text-mute">{poll.pct[i]}%</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
        </div>
      )}

      {isMod && !poll?.open && (
        <div className="border-b border-line px-3 py-1 text-xs">
          {!creating ? (
            <button onClick={() => setCreating(true)} className="text-wine hover:underline">📊 Abrir enquete</button>
          ) : (
            <form
              className="space-y-1.5 py-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await call("POST", { question, options, minutes })) {
                  setCreating(false);
                  setQuestion("");
                  setOptions(["", ""]);
                }
              }}
            >
              <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={140} required placeholder="Pergunta (ex.: Qual a melhor noite para a festa?)" className="input py-1 text-sm" />
              <div className="grid gap-1 sm:grid-cols-2">
                {options.map((o, i) => (
                  <input key={i} value={o} maxLength={60} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opção ${i + 1}`} className="input py-1 text-sm" />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {options.length < ROOM_POLL.maxOptions && <button type="button" onClick={() => setOptions([...options, ""])} className="btn-ghost py-0.5 text-xs">+ opção</button>}
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="input w-auto py-0.5 text-xs" aria-label="Duração">
                  {[1, 2, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
                <span className="flex-1" />
                <button type="button" onClick={() => setCreating(false)} className="btn-ghost py-0.5 text-xs">Cancelar</button>
                <button disabled={busy} className="btn-gold py-0.5 text-xs">Abrir enquete</button>
              </div>
              {err && <p className="text-xs text-red-700">{err}</p>}
            </form>
          )}
        </div>
      )}
    </>
  );
}
