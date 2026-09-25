"use client";

import { useEffect, useRef, useState } from "react";
import { sendPmAudio } from "@/app/actions/pm";
import { VOICE, voiceClock } from "@/lib/voice";

/** Balão de áudio no PV. */
export function VoiceNote({ id, secs }: { id: string; secs: number }) {
  return (
    <div className="flex items-center gap-2" data-testid="pm-audio">
      <span aria-hidden className="text-lg">🎤</span>
      <audio controls preload="none" src={`/api/media/${id}`} className="h-9 w-56 max-w-full" />
      <span className="text-xs text-mute">{voiceClock(secs)}</span>
    </div>
  );
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** Botão 🎤: toca para gravar, toca de novo para enviar, ✕ cancela. Para sozinho em 60 s. */
export function VoiceRecorder({ nick, disabledReason, onSent, onError }: { nick: string; disabledReason: string | null; onSent: () => void; onError: (e: string) => void }) {
  const [rec, setRec] = useState<{ mr: MediaRecorder; stream: MediaStream; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sending, setSending] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      const s = (Date.now() - rec.started) / 1000;
      setElapsed(s);
      if (s >= VOICE.maxSecs) stop(false);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);
  useEffect(() => () => rec?.stream.getTracks().forEach((t) => t.stop()), [rec]);

  async function start() {
    if (disabledReason) return onError(disabledReason);
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) return onError("Seu navegador não grava áudio.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Libere o microfone para gravar.");
    }
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined);
    chunks.current = [];
    cancelled.current = false;
    const started = Date.now();
    mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const secs = (Date.now() - started) / 1000;
      if (cancelled.current) return;
      if (secs < 1) return onError("Segure um pouco mais: áudio muito curto.");
      const blob = new Blob(chunks.current, { type: mr.mimeType || mime || "audio/webm" });
      const fd = new FormData();
      fd.set("audio", blob, "voz");
      fd.set("secs", String(Math.min(VOICE.maxSecs, secs)));
      setSending(true);
      const r = await sendPmAudio(nick, fd).catch(() => ({ ok: false, error: "Falha ao enviar o áudio." }));
      setSending(false);
      if (r.ok) onSent();
      else onError(r.error ?? "Erro");
    };
    mr.start(1000);
    setElapsed(0);
    setRec({ mr, stream, started });
  }

  function stop(cancel: boolean) {
    if (!rec) return;
    cancelled.current = cancel;
    if (rec.mr.state !== "inactive") rec.mr.stop();
    setRec(null);
  }

  if (rec)
    return (
      <div className="flex items-center gap-2" data-testid="gravando">
        <button type="button" onClick={() => stop(true)} className="rounded-full px-2 text-lg text-mute" aria-label="Cancelar áudio">✕</button>
        <span className="flex items-center gap-1 text-sm font-semibold text-wine"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />{voiceClock(elapsed)}</span>
        <button type="button" onClick={() => stop(false)} className="btn-gold" aria-label="Enviar áudio">Enviar</button>
      </div>
    );

  return (
    <button type="button" onClick={start} disabled={sending} title={disabledReason ?? "Gravar áudio (até 60 s)"} aria-label="Gravar áudio"
      className={`btn-gold px-3 ${disabledReason ? "opacity-50" : ""}`} data-testid="gravar">
      {sending ? "…" : "🎤"}
    </button>
  );
}
