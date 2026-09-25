/** Mensagens de voz no PV: regras puras (testadas em tests/voice.test.ts). */

export const VOICE = {
  maxSecs: 60,
  minBytes: 500,
  /** 60 s de AAC (Safari) ficam perto de 1 MB; opus (Chrome/Android) bem menos */
  maxBytes: 2 * 1024 * 1024,
  perHour: 30,
} as const;

/** Consentimento de áudio de cada lado da conversa. */
export type AudioConsent = { mine: boolean; theirs: boolean };

/** Por que ainda não dá para mandar áudio (null = liberado: os dois aceitaram). */
export function audioBlockReason(c: AudioConsent, otherNick: string) {
  if (!c.mine) return "Ative “Aceito áudio” no topo da conversa. O áudio só libera quando os dois aceitam.";
  if (!c.theirs) return `Aguardando @${otherNick} aceitar áudio também.`;
  return null;
}

/** Mensagem parece levar a conversa para fora (telefone, WhatsApp, Telegram…)? Só para mostrar uma dica, nunca bloqueia. */
export function looksOffPlatform(text: string) {
  return /(\d[\s().-]*){8,}|whats|zap\b|wpp|telegram|\btg\b|wa\.me|t\.me\//i.test(text);
}

export type AudioFormat = { mime: "audio/webm" | "audio/ogg" | "audio/mp4"; ext: "webm" | "ogg" | "m4a" };

/** Descobre o formato pelos primeiros bytes (não confia no tipo que o navegador diz). */
export function sniffAudio(buf: Uint8Array): AudioFormat | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "audio/webm", ext: "webm" };
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return { mime: "audio/ogg", ext: "ogg" };
  // MP4/M4A: "ftyp" a partir do 5º byte
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return { mime: "audio/mp4", ext: "m4a" };
  return null;
}

/** Duração informada pelo navegador, limitada a 1..60 s. */
export function clampSecs(raw: unknown) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(VOICE.maxSecs, Math.max(1, n));
}

/** 0:07, 1:00 */
export function voiceClock(secs: number) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
