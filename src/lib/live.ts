/** Regras puras do Ao vivo (testadas em tests/live.test.ts). */

export const LIVE = {
  /** espectadores com vídeo por transmissão (cada um consome upload de quem transmite) */
  maxViewers: Math.max(1, Number(process.env.LIVE_MAX_VIEWERS || 10)),
  /** % da gorjeta que fica com a plataforma (0 = tudo para quem transmite) */
  feePct: Math.min(50, Math.max(0, Number(process.env.LIVE_TIP_FEE_PCT || 0))),
  /** sem heartbeat de quem transmite por este tempo = transmissão encerrada */
  staleMs: 25_000,
  /** espectador conta como "assistindo" até este tempo sem polling */
  viewerWindowMs: 15_000,
  minTip: 1,
  maxTip: 100_000,
  tipPresets: [10, 25, 50, 100, 500] as const,
};

export const SIGNAL_KINDS = ["hello", "offer", "answer", "bye", "full"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** Valida valor de gorjeta; devolve mensagem de erro ou null. */
export function tipError(amount: unknown): string | null {
  if (typeof amount !== "number" || !Number.isInteger(amount)) return "Valor inválido";
  if (amount < LIVE.minTip) return `Mínimo de ${LIVE.minTip}`;
  if (amount > LIVE.maxTip) return `Máximo de ${LIVE.maxTip} por gorjeta`;
  return null;
}

/** Divide a gorjeta entre quem transmite e a plataforma (arredonda a taxa para baixo). */
export function splitTip(amount: number, feePct = LIVE.feePct) {
  const fee = Math.floor((amount * feePct) / 100);
  return { host: amount - fee, fee };
}

/**
 * Quem pode mandar qual sinal para quem. Espectador só fala com quem transmite
 * (hello/answer/bye); quem transmite só fala com espectadores (offer/full/bye).
 */
export function signalAllowed(kind: string, fromId: string, toId: string, hostId: string): boolean {
  if (!(SIGNAL_KINDS as readonly string[]).includes(kind) || fromId === toId) return false;
  if (fromId === hostId) return kind === "offer" || kind === "full" || kind === "bye";
  return toId === hostId && (kind === "hello" || kind === "answer" || kind === "bye");
}

export function isStale(lastBeatAt: Date, now = Date.now()) {
  return now - lastBeatAt.getTime() > LIVE.staleMs;
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Servidores ICE para o WebRTC. STUN público por padrão; TURN opcional via env. */
export function iceServers(): { urls: string | string[]; username?: string; credential?: string }[] {
  const list: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: (process.env.LIVE_STUN_URLS || "stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478").split(",").map((s) => s.trim()).filter(Boolean) },
  ];
  if (process.env.LIVE_TURN_URLS)
    list.push({ urls: process.env.LIVE_TURN_URLS.split(",").map((s) => s.trim()), username: process.env.LIVE_TURN_USERNAME, credential: process.env.LIVE_TURN_CREDENTIAL });
  return list;
}
