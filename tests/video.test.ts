import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
const { sniffVideo } = await import("@/server/media");

describe("detecção de vídeo por bytes (não confia na extensão)", () => {
  it("reconhece MP4, MOV e WEBM", () => {
    expect(sniffVideo(Buffer.from("\x00\x00\x00\x18ftypisom0000", "latin1"))).toBe("video/mp4");
    expect(sniffVideo(Buffer.from("\x00\x00\x00\x14ftypqt  0000", "latin1"))).toBe("video/quicktime");
    expect(sniffVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe("video/webm");
  });
  it("recusa outros arquivos disfarçados", () => {
    expect(sniffVideo(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffVideo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // jpeg
    expect(sniffVideo(Buffer.from("MZ\x90\x00", "latin1"))).toBeNull(); // exe
  });
});
