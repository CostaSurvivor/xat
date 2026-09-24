"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NickStyleJSON } from "@/lib/items";
import type { LiveChatMessage } from "@/server/live";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ReportButton } from "./ReportButton";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { fmtDuration } from "@/lib/live";

type Ice = { urls: string | string[]; username?: string; credential?: string }[];
type Signal = { id: string; from: string; kind: string; payload: string | null };
type Viewer = { id: string; nick: string; avatarId: string | null };
type Top = { id: string; nick: string; total: number; style?: NickStyleJSON };
type Stats = { tipTotal: number; tipGoal: number | null; goalLabel: string | null; viewers: number; peak: number; viewerList: Viewer[]; top: Top[] };
type FloatTip = { key: string; nick: string; amount: number };

export type LiveInfo = {
  id: string;
  title: string;
  hostId: string;
  hostNick: string;
  hostAvatarId: string | null;
  hostStyle?: NickStyleJSON;
  startedAt: string;
  audience: string;
  status: "LIVE" | "ENDED";
};

const EMOJIS = ["🔥", "😍", "😈", "🥵", "💦", "👏", "❤️", "😘", "🌶️", "👀", "🤤", "💋"];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);

/** Espera o ICE terminar de coletar candidatos (sinalização sem trickle = 1 offer + 1 answer). */
function gathered(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const t = setTimeout(done, ms);
    function check() { if (pc.iceGatheringState === "complete") done(); }
    function done() { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", check); resolve(); }
    pc.addEventListener("icegatheringstatechange", check);
  });
}

function ding(big: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    (big ? [523, 659, 784, 1046, 1318] : [784, 1046]).forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.35);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

async function post(url: string, body: object, keepalive = false) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: (j as { error?: string }).error };
}

export function LiveRoom({ live, me, ice, maxViewers, presets }: { live: LiveInfo; me: { id: string; nick: string }; ice: Ice; maxViewers: number; presets: readonly number[] }) {
  const isHost = me.id === live.hostId;
  const base = `/api/live/${live.id}`;
  const [status, setStatus] = useState(live.status);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<LiveChatMessage[]>([]);
  const [stats, setStats] = useState<Stats>({ tipTotal: 0, tipGoal: null, goalLabel: null, viewers: 0, peak: 0, viewerList: [], top: [] });
  const [meInfo, setMeInfo] = useState({ canMod: isHost, balance: 0 });
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatTip[]>([]);
  const [now, setNow] = useState(0); // 0 no SSR: evita diferença de hidratação no relógio
  const [tab, setTab] = useState<"chat" | "gente">("chat");
  const [muted, setMuted] = useState(true); // autoplay só funciona mudo
  const [soundFx, setSoundFx] = useState(true);
  const [videoState, setVideoState] = useState<"idle" | "connecting" | "playing" | "full" | "nocam">(isHost ? "idle" : "connecting");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [linked, setLinked] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(presets[1] ?? 25);
  const [tipMsg, setTipMsg] = useState("");
  const [tipBusy, setTipBusy] = useState(false);
  const [menu, setMenu] = useState<{ id: string; nick: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<string | null>(null);
  const sigRef = useRef<string | null>(null);
  const firstRef = useRef(true);
  const statusRef = useRef(status);
  statusRef.current = status;
  const soundRef = useRef(soundFx);
  soundRef.current = soundFx;
  // host
  const localRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingRef = useRef(new Set<string>());
  const facingRef = useRef<"user" | "environment">("user");
  // espectador
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const helloAtRef = useRef(0);
  const fullRef = useRef(false);

  const signal = useCallback((kind: string, to?: string, payload?: string, keepalive = false) => post(`${base}/signal`, { kind, to, payload }, keepalive), [base]);

  // ---------------------------------------------------------------- host
  const countLinked = useCallback(() => setLinked([...peersRef.current.values()].filter((p) => p.connectionState === "connected").length), []);
  const dropPeer = useCallback((id: string) => {
    const pc = peersRef.current.get(id);
    if (pc) { pc.close(); peersRef.current.delete(id); }
    countLinked();
  }, [countLinked]);

  const offerTo = useCallback(async (viewerId: string) => {
    const stream = localRef.current;
    if (!stream) { pendingRef.current.add(viewerId); return; }
    if (!peersRef.current.has(viewerId) && peersRef.current.size >= maxViewers) { await signal("full", viewerId); return; }
    dropPeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: ice });
    peersRef.current.set(viewerId, pc);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") { if (peersRef.current.get(viewerId) === pc) dropPeer(viewerId); }
      if (pc.connectionState === "connected") {
        // limita o upload por espectador (~700 kbps de vídeo)
        pc.getSenders().forEach((s) => {
          if (s.track?.kind !== "video") return;
          const p = s.getParameters();
          if (!p.encodings?.length) p.encodings = [{}];
          p.encodings[0].maxBitrate = 700_000;
          s.setParameters(p).catch(() => {});
        });
      }
      countLinked();
    };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    if (peersRef.current.get(viewerId) !== pc) return;
    await signal("offer", viewerId, pc.localDescription?.sdp);
  }, [ice, maxViewers, signal, dropPeer, countLinked]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 }, facingMode: facingRef.current },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; await videoRef.current.play().catch(() => {}); }
      setVideoState("playing");
      setCamOn(true);
      setMicOn(true);
      for (const v of [...pendingRef.current]) { pendingRef.current.delete(v); void offerTo(v); }
    } catch {
      setVideoState("nocam");
    }
  }, [offerTo]);

  const switchCamera = async () => {
    const old = localRef.current?.getVideoTracks()[0];
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingRef.current, width: { ideal: 960 }, height: { ideal: 540 } } });
      const track = s.getVideoTracks()[0];
      for (const pc of peersRef.current.values()) pc.getSenders().find((x) => x.track?.kind === "video")?.replaceTrack(track);
      if (old && localRef.current) { localRef.current.removeTrack(old); old.stop(); localRef.current.addTrack(track); }
      if (videoRef.current && localRef.current) videoRef.current.srcObject = localRef.current;
      setCamOn(true);
    } catch {
      setErr("Não foi possível trocar a câmera.");
    }
  };
  const toggleTrack = (kind: "audio" | "video") => {
    const t = kind === "audio" ? localRef.current?.getAudioTracks()[0] : localRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    if (kind === "audio") setMicOn(t.enabled); else setCamOn(t.enabled);
  };
  const stopHost = useCallback(() => {
    for (const id of [...peersRef.current.keys()]) dropPeer(id);
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
  }, [dropPeer]);

  // ------------------------------------------------------------ espectador
  const closeViewer = useCallback(() => { pcRef.current?.close(); pcRef.current = null; }, []);
  const hello = useCallback(async () => {
    helloAtRef.current = Date.now();
    setVideoState((s) => (s === "playing" ? s : fullRef.current ? "full" : "connecting"));
    await signal("hello");
  }, [signal]);

  const onOffer = useCallback(async (sdp: string) => {
    closeViewer();
    fullRef.current = false;
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;
    pc.ontrack = (e) => {
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      v.play().then(() => setVideoState("playing")).catch(() => setVideoState("playing"));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setVideoState("playing");
      if (pc.connectionState === "failed") { setVideoState("connecting"); helloAtRef.current = 0; }
    };
    await pc.setRemoteDescription({ type: "offer", sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    if (pcRef.current !== pc) return;
    await signal("answer", undefined, pc.localDescription?.sdp);
  }, [ice, signal, closeViewer]);

  // ----------------------------------------------------------------- poll
  const handleSignals = useCallback(async (sigs: Signal[]) => {
    for (const s of sigs) {
      try {
        if (isHost) {
          if (s.kind === "hello") await offerTo(s.from);
          else if (s.kind === "answer" && s.payload) {
            const pc = peersRef.current.get(s.from);
            if (pc && pc.signalingState === "have-local-offer") await pc.setRemoteDescription({ type: "answer", sdp: s.payload });
          } else if (s.kind === "bye") dropPeer(s.from);
        } else {
          if (s.kind === "offer" && s.payload) await onOffer(s.payload);
          else if (s.kind === "full") { fullRef.current = true; setVideoState("full"); }
          else if (s.kind === "bye") { closeViewer(); setVideoState("connecting"); helloAtRef.current = 0; }
        }
      } catch {}
    }
  }, [isHost, offerTo, dropPeer, onOffer, closeViewer]);

  const poll = useCallback(async () => {
    const qs = new URLSearchParams();
    if (afterRef.current) qs.set("after", afterRef.current);
    if (sigRef.current) qs.set("sig", sigRef.current);
    const r = await fetch(`${base}/poll?${qs}`, { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) {
      if (r.status === 403 || r.status === 404 || r.status === 401) { setFatal(j?.error ?? "Sem acesso."); closeViewer(); stopHost(); return false; }
      return true;
    }
    const first = firstRef.current;
    firstRef.current = false;
    const incoming: LiveChatMessage[] = j.messages;
    if (incoming.length) {
      afterRef.current = incoming[incoming.length - 1].id;
      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !seen.has(m.id))].slice(-200);
      });
      if (!first) {
        const tips = incoming.filter((m) => m.kind === "TIP" && m.author);
        if (tips.length) {
          if (soundRef.current) ding(tips.some((t) => (t.amount ?? 0) >= 100));
          const add = tips.map((t) => ({ key: t.id, nick: t.author!.nick, amount: t.amount ?? 0 }));
          setFloats((f) => [...f, ...add].slice(-6));
          setTimeout(() => setFloats((f) => f.filter((x) => !add.some((a) => a.key === x.key))), 4200);
        }
      }
    }
    if (j.deleted?.length) setMsgs((prev) => prev.filter((m) => !j.deleted.includes(m.id)));
    if (j.signals?.length) { sigRef.current = j.signals[j.signals.length - 1].id; await handleSignals(j.signals); }
    setStats({ tipTotal: j.tipTotal, tipGoal: j.tipGoal, goalLabel: j.goalLabel, viewers: j.viewers, peak: j.peak, viewerList: j.viewerList, top: j.top });
    setMeInfo({ canMod: j.me.canMod, balance: j.me.balance });
    if (j.status === "ENDED") {
      setStatus("ENDED");
      setEndReason(j.endReason);
      closeViewer();
      stopHost();
      return false;
    }
    if (isHost) {
      // quem saiu ou foi removido deixa de receber vídeo
      const present = new Set((j.viewerList as Viewer[]).map((v) => v.id));
      for (const id of [...peersRef.current.keys()]) if (!present.has(id)) dropPeer(id);
    }
    return true;
  }, [base, handleSignals, isHost, closeViewer, stopHost, dropPeer]);

  useEffect(() => {
    if (live.status !== "LIVE") { void poll(); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      let keep = true;
      try { keep = await poll(); } catch {}
      if (alive && keep) timer = setTimeout(loop, isHost ? 1500 : 2000);
    };
    if (isHost) void startCamera();
    else void hello();
    void loop();
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // espectador: se não conectou em ~12 s (ou caiu), pede o vídeo de novo
    const watchdog = !isHost
      ? setInterval(() => {
          if (statusRef.current !== "LIVE") return;
          const st = pcRef.current?.connectionState;
          const ok = st === "connected" || st === "connecting" || st === "new";
          const wait = fullRef.current ? 20_000 : 12_000;
          if ((!ok || !pcRef.current) && Date.now() - helloAtRef.current > wait) void hello();
        }, 4000)
      : undefined;
    const bye = () => { if (!isHost) void signal("bye", undefined, undefined, true); };
    window.addEventListener("pagehide", bye);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
      if (watchdog) clearInterval(watchdog);
      window.removeEventListener("pagehide", bye);
      bye();
      closeViewer();
      stopHost();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    const r = await post(`${base}/chat`, { body });
    if (!r.ok) { setErr(r.error ?? "Erro"); setText(body); } else { setErr(null); void poll(); }
  };
  const tip = async (amount: number) => {
    if (tipBusy) return;
    if (amount > meInfo.balance) { setErr(`Saldo insuficiente (${meInfo.balance} ${CURRENCY_NAME}).`); return; }
    if (amount >= 500 && !confirm(`Enviar ${amount} ${CURRENCY_NAME} de gorjeta para @${live.hostNick}?`)) return;
    setTipBusy(true);
    const r = await post(`${base}/tip`, { amount, message: tipMsg, key: newKey() });
    setTipBusy(false);
    if (!r.ok) setErr(r.error ?? "Erro");
    else { setErr(null); setTipMsg(""); setTipOpen(false); void poll(); }
  };
  const mod = async (action: "delete" | "kick" | "end", target?: string) => {
    if (action === "end" && !confirm(isHost ? "Encerrar a transmissão?" : "Encerrar esta transmissão (moderação)?")) return;
    if (action === "kick" && !confirm("Remover esta pessoa da transmissão?")) return;
    const r = await post(`${base}/mod`, { action, target });
    if (!r.ok) setErr(r.error ?? "Erro");
    setMenu(null);
    void poll();
  };

  const elapsed = now ? fmtDuration(now - new Date(live.startedAt).getTime()) : "";
  const goalPct = stats.tipGoal ? Math.min(100, Math.round((stats.tipTotal / stats.tipGoal) * 100)) : 0;
  const ended = status === "ENDED";

  if (fatal)
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-semibold">😕 {fatal}</p>
        <Link href="/ao-vivo" className="btn-gold mt-4">Ver outras transmissões</Link>
      </div>
    );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr]">
      {/* ------------------------------------------------ vídeo */}
      <div className="space-y-2 lg:col-start-1 lg:row-start-1">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-black" onContextMenu={(e) => e.preventDefault()}>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted={isHost || muted}
            className={`aspect-video w-full bg-black object-contain ${isHost && facingRef.current === "user" ? "-scale-x-100" : ""}`}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
          />
          {/* marca d'água com quem assiste (desencoraja gravação/print) */}
          {!isHost && !ended && videoState === "playing" && (
            <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
              <span className="live-wm absolute text-sm font-semibold text-white/25">@{me.nick} · {new Date(now).toLocaleDateString("pt-BR")}</span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex items-center gap-1.5 text-xs">
            {ended ? <span className="rounded bg-zinc-700 px-2 py-0.5 font-bold">ENCERRADA</span> : <span className="live-dot rounded bg-red-600 px-2 py-0.5 font-bold">● AO VIVO</span>}
            {!ended && elapsed && <span className="rounded bg-black/60 px-2 py-0.5">{elapsed}</span>}
            <span className="rounded bg-black/60 px-2 py-0.5">👁 {stats.viewers}</span>
            {live.audience === "VIP" && <span className="rounded bg-fuchsia-700/80 px-2 py-0.5">💎 assinantes</span>}
          </div>
          {/* gorjetas flutuando */}
          <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1">
            {floats.map((f) => (
              <div key={f.key} className="tip-float rounded-full border border-gold/60 bg-gradient-to-r from-wine/90 to-gold/80 px-3 py-1 text-sm font-bold text-white shadow-lg">
                {CURRENCY_ICON} +{f.amount} <span className="font-normal">@{f.nick}</span>
              </div>
            ))}
          </div>
          {/* estados */}
          {!ended && videoState !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm">
              {isHost && videoState === "idle" && <p className="text-mute">Ligando a câmera…</p>}
              {isHost && videoState === "nocam" && (
                <>
                  <p>Precisamos da sua câmera e microfone para transmitir.</p>
                  <button onClick={() => void startCamera()} className="btn-gold">🎥 Permitir câmera</button>
                </>
              )}
              {!isHost && videoState === "connecting" && (
                <>
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                  <p className="text-mute">Conectando ao vídeo de @{live.hostNick}…</p>
                </>
              )}
              {!isHost && videoState === "full" && (
                <p className="max-w-sm text-mute">
                  Transmissão lotada ({maxViewers} pessoas com vídeo). Você continua no chat e pode mandar gorjeta. Assim que abrir vaga, o vídeo entra sozinho.
                </p>
              )}
            </div>
          )}
          {ended && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center">
              <p className="text-lg font-semibold">Transmissão encerrada</p>
              {endReason && <p className="text-sm text-mute">{endReason}</p>}
              <p className="text-sm">Pico de {stats.peak} espectadores · {stats.tipTotal} {CURRENCY_NAME} em gorjetas</p>
              <Link href="/ao-vivo" className="btn-gold mt-2">Outras transmissões</Link>
            </div>
          )}
          {!isHost && videoState === "playing" && muted && !ended && (
            <button onClick={() => { setMuted(false); void videoRef.current?.play(); }} className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1.5 text-sm">🔇 Ativar som</button>
          )}
          {!isHost && videoState === "playing" && !muted && !ended && (
            <button onClick={() => setMuted(true)} className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1.5 text-sm">🔊</button>
          )}
        </div>

        {/* título, host, ações */}
        <div className="flex flex-wrap items-center gap-2">
          <Avatar mediaId={live.hostAvatarId} nick={live.hostNick} size={40} style={live.hostStyle} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{live.title}</h1>
            <p className="text-sm"><Nick nick={live.hostNick} style={live.hostStyle} /></p>
          </div>
          {isHost && !ended && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => toggleTrack("audio")} className={micOn ? "btn-ghost" : "btn-wine"} title="Microfone">{micOn ? "🎙️" : "🔇"}</button>
              <button onClick={() => toggleTrack("video")} className={camOn ? "btn-ghost" : "btn-wine"} title="Câmera">{camOn ? "📷" : "🚫"}</button>
              <button onClick={() => void switchCamera()} className="btn-ghost" title="Trocar câmera">🔄</button>
              <button onClick={() => void mod("end")} className="btn-wine">⏹ Encerrar</button>
            </div>
          )}
          {!isHost && !ended && meInfo.canMod && <button onClick={() => void mod("end")} className="btn-wine text-xs">⏹ Encerrar (moderação)</button>}
          {!isHost && <ReportButton targetType="LIVE" targetId={live.id} />}
        </div>
        {isHost && !ended && (
          <p className="text-xs text-mute">
            📡 {linked} de {Math.min(stats.viewers, maxViewers)} espectadores recebendo vídeo (máx. {maxViewers}). O vídeo sai direto do seu aparelho: use Wi-Fi e mantenha esta aba aberta.
          </p>
        )}

        {/* meta de gorjetas */}
        {stats.tipGoal && (
          <div className="card p-3">
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-gold">🎯 {stats.goalLabel || "Meta"}</span>
              <span>{stats.tipTotal} / {stats.tipGoal} {CURRENCY_ICON}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-panel2">
              <div className="h-full rounded-full bg-gradient-to-r from-wine2 to-gold transition-all duration-700" style={{ width: `${goalPct}%` }} />
            </div>
            {goalPct >= 100 && <p className="mt-1 text-center text-xs font-semibold text-gold2">🎉 Meta batida!</p>}
          </div>
        )}

      </div>

      {/* ------------------------------------------------ chat */}
      <div className="card flex h-[60dvh] flex-col overflow-hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-8rem)]">
        <div className="flex border-b border-line text-sm">
          <button onClick={() => setTab("chat")} className={`flex-1 py-2 ${tab === "chat" ? "border-b-2 border-gold text-white" : "text-mute"}`}>💬 Chat</button>
          <button onClick={() => setTab("gente")} className={`flex-1 py-2 ${tab === "gente" ? "border-b-2 border-gold text-white" : "text-mute"}`}>👁 Assistindo ({stats.viewers})</button>
          <button onClick={() => setSoundFx((s) => !s)} className="px-3 text-mute" title="Som das gorjetas">{soundFx ? "🔔" : "🔕"}</button>
        </div>

        {tab === "gente" ? (
          <div className="flex-1 overflow-y-auto p-2">
            {stats.viewerList.length === 0 && <p className="p-3 text-sm text-mute">Ninguém assistindo ainda.</p>}
            {stats.viewerList.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2">
                <Avatar mediaId={v.avatarId} nick={v.nick} size={28} />
                <Link href={`/u/${encodeURIComponent(v.nick)}`} className="flex-1 truncate text-sm hover:underline">{v.nick}</Link>
                {meInfo.canMod && v.id !== me.id && <button onClick={() => void mod("kick", v.id)} className="text-xs text-red-300 hover:underline">Remover</button>}
              </div>
            ))}
          </div>
        ) : (
          <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-2 text-sm">
            {msgs.map((m) => {
              if (m.kind === "SYSTEM") return <p key={m.id} className="px-1 text-xs italic text-mute">{m.body}</p>;
              if (m.kind === "TIP" && m.author)
                return (
                  <div key={m.id} className="entry-pop rounded-xl border border-gold/40 bg-gradient-to-r from-gold/20 via-wine/30 to-transparent px-3 py-2">
                    <span className="mr-1">{CURRENCY_ICON}</span>
                    <Nick nick={m.author.nick} style={m.author.style} /> deu <b className="text-gold2">{m.amount} {CURRENCY_NAME}</b>
                    {m.body && <p className="mt-0.5 break-words text-white/90">“{m.body}”</p>}
                  </div>
                );
              if (!m.author) return null;
              const isMine = m.author.id === me.id;
              return (
                <div key={m.id} className="group flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-panel2/60">
                  <span className="shrink-0 text-[10px] leading-5 text-mute">{hhmm(m.createdAt)}</span>
                  <p className="min-w-0 flex-1 break-words">
                    <button onClick={() => setMenu(isMine ? null : { id: m.author!.id, nick: m.author!.nick })} className="mr-1">
                      <Nick nick={m.author.nick} style={m.author.style} link={false} />
                      {m.author.id === live.hostId && <span className="ml-1 rounded bg-red-600 px-1 text-[9px] font-bold align-middle">HOST</span>}
                    </button>
                    {m.body}
                  </p>
                  {meInfo.canMod && <button onClick={() => void mod("delete", m.id)} className="hidden text-xs text-mute hover:text-red-300 group-hover:inline" title="Apagar">✕</button>}
                </div>
              );
            })}
          </div>
        )}

        {menu && (
          <div className="flex items-center gap-2 border-t border-line bg-panel2 px-3 py-2 text-sm">
            <span className="flex-1 truncate font-semibold">@{menu.nick}</span>
            <Link href={`/u/${encodeURIComponent(menu.nick)}`} className="text-gold hover:underline">Perfil</Link>
            <button onClick={() => { setText((t) => `@${menu.nick} ${t}`); setMenu(null); }} className="text-gold hover:underline">Responder</button>
            {meInfo.canMod && menu.id !== live.hostId && <button onClick={() => void mod("kick", menu.id)} className="text-red-300 hover:underline">Remover</button>}
            <button onClick={() => setMenu(null)} className="text-mute">✕</button>
          </div>
        )}

        {err && <p className="border-t border-line px-3 py-1.5 text-xs text-red-300" onClick={() => setErr(null)}>{err}</p>}

        {!ended && (
          <div className="border-t border-line p-2">
            {tipOpen && !isHost && (
              <div className="mb-2 space-y-2 rounded-xl border border-gold/30 bg-panel2 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gold">Gorjeta para @{live.hostNick}</span>
                  <span className="text-mute">Saldo: {meInfo.balance} {CURRENCY_ICON} · <Link href="/carteira" className="underline">comprar</Link></span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {presets.map((p) => (
                    <button key={p} type="button" onClick={() => setTipAmount(p)} className={`rounded-full border px-2.5 py-1 text-xs ${tipAmount === p ? "border-gold bg-gold/20 text-gold2" : "border-line"}`}>{p} {CURRENCY_ICON}</button>
                  ))}
                  <input type="number" min={1} value={tipAmount} onChange={(e) => setTipAmount(Math.max(1, Math.floor(Number(e.target.value) || 0)))} className="input w-24 py-1 text-xs" aria-label="Outro valor" />
                </div>
                <input value={tipMsg} onChange={(e) => setTipMsg(e.target.value)} maxLength={140} placeholder="Recado junto (opcional)" className="input py-1.5 text-xs" />
                <button type="button" disabled={tipBusy} onClick={() => void tip(tipAmount)} className="btn-gold w-full">{tipBusy ? "Enviando…" : `Enviar ${tipAmount} ${CURRENCY_NAME}`}</button>
              </div>
            )}
            <form onSubmit={send} className="flex items-center gap-1.5">
              {!isHost && (
                <button type="button" onClick={() => setTipOpen((o) => !o)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${tipOpen ? "bg-gold text-ink" : "bg-wine text-white"}`} title="Dar gorjeta">{CURRENCY_ICON}</button>
              )}
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Diga algo…" className="input flex-1" />
              <button className="btn-gold shrink-0 px-3">➤</button>
            </form>
            <div className="mt-1 flex gap-1 overflow-x-auto">
              {EMOJIS.map((e) => <button key={e} type="button" onClick={() => setText((t) => t + e)} className="text-lg">{e}</button>)}
            </div>
          </div>
        )}
      </div>
      <div className="lg:col-start-1 lg:row-start-2">
        {stats.top.length > 0 && (
          <div className="card p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">Quem mais apoiou</p>
            <ol className="space-y-0.5 text-sm">
              {stats.top.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="w-5">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
                  <Nick nick={t.nick} style={t.style} />
                  <span className="ml-auto text-gold">{t.total} {CURRENCY_ICON}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
