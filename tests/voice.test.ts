import { describe, expect, it } from "vitest";
import { VOICE, audioBlockReason, clampSecs, looksOffPlatform, sniffAudio, voiceClock } from "@/lib/voice";

const pad = (head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);

describe("sniffAudio", () => {
  it("reconhece webm, ogg e mp4", () => {
    expect(sniffAudio(pad([0x1a, 0x45, 0xdf, 0xa3]))?.mime).toBe("audio/webm");
    expect(sniffAudio(pad([0x4f, 0x67, 0x67, 0x53]))?.mime).toBe("audio/ogg");
    expect(sniffAudio(pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))?.ext).toBe("m4a");
  });
  it("recusa outros arquivos", () => {
    expect(sniffAudio(pad([0xff, 0xd8, 0xff, 0xe0]))).toBeNull(); // JPEG
    expect(sniffAudio(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffAudio(new Uint8Array([0x1a, 0x45]))).toBeNull();
  });
});

describe("clampSecs / voiceClock", () => {
  it("limita a duração", () => {
    expect(clampSecs("12.4")).toBe(12);
    expect(clampSecs(0)).toBe(1);
    expect(clampSecs(999)).toBe(VOICE.maxSecs);
    expect(clampSecs("x")).toBe(1);
  });
  it("formata m:ss", () => {
    expect(voiceClock(7)).toBe("0:07");
    expect(voiceClock(60)).toBe("1:00");
  });
});

describe("audioBlockReason (os dois precisam aceitar)", () => {
  it("só libera com os dois lados", () => {
    expect(audioBlockReason({ mine: true, theirs: true }, "x")).toBeNull();
    expect(audioBlockReason({ mine: false, theirs: true }, "x")).toMatch(/Aceito áudio/);
    expect(audioBlockReason({ mine: true, theirs: false }, "Ana")).toMatch(/@Ana/);
    expect(audioBlockReason({ mine: false, theirs: false }, "x")).not.toBeNull();
  });
});

describe("looksOffPlatform (só dica, não bloqueia)", () => {
  it("reconhece contato de fora", () => {
    for (const t of ["me chama no whats", "meu zap 51 99999-1234", "(11) 9 8888-7777", "tem telegram?", "t.me/fulano", "wa.me/55119"]) expect(looksOffPlatform(t), t).toBe(true);
  });
  it("não dispara em conversa comum", () => {
    for (const t of ["oi, tudo bem?", "sábado às 22h no centro", "temos 35 e 33 anos"]) expect(looksOffPlatform(t), t).toBe(false);
  });
});
