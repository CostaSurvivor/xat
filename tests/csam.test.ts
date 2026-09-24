/** Detecção de CSAM: positivo => upload recusado, mídia em quarentena, hash bloqueado, denúncia prioritária. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d("scanner de CSAM", async () => {
  let server: Server;
  let match = true;
  const db = new PrismaClient();
  const tag = randomBytes(4).toString("hex");
  let userId = "";

  beforeAll(async () => {
    server = createServer((_, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ match })); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    vi.stubEnv("CSAM_SCAN_URL", `http://127.0.0.1:${port}/scan`);
    vi.stubEnv("UPLOAD_DIR", `/tmp/claude-0/csam-test-${tag}`);
    userId = (await db.user.create({ data: { email: `cs-${tag}@t.local`, passwordHash: "x", nick: `cs${tag}`, birthDate: new Date("1990-01-01"), profileType: "SINGLE_MAN" } })).id;
  });
  afterAll(async () => {
    server.close();
    const media = await db.media.findMany({ where: { ownerId: userId } });
    await db.mediaHashBlock.deleteMany({ where: { sha256: { in: media.map((m) => m.sha256) } } });
    await db.report.deleteMany({ where: { targetUserId: userId } });
    await db.media.deleteMany({ where: { ownerId: userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  const img = async (seed: number) =>
    new File([new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: seed, g: 10, b: 20 } } }).png().toBuffer())], "a.png", { type: "image/png" });

  it("positivo: recusa, quarentena, bloqueio e denúncia prioritária", async () => {
    const { processUpload } = await import("@/server/media");
    await expect(processUpload({ file: await img(1), ownerId: userId, ownerNick: "x", kind: "POST" })).rejects.toThrow(/não é permitida/);
    const m = await db.media.findFirst({ where: { ownerId: userId } });
    expect(m?.status).toBe("QUARANTINED");
    expect(await db.mediaHashBlock.findUnique({ where: { sha256: m!.sha256 } })).not.toBeNull();
    const r = await db.report.findFirst({ where: { targetUserId: userId } });
    expect(r?.reason).toBe("POSSIBLE_MINOR");
    expect(r?.priority).toBe(100);
  });

  it("negativo: publica normalmente", async () => {
    match = false;
    const { processUpload } = await import("@/server/media");
    const m = await processUpload({ file: await img(200), ownerId: userId, ownerNick: "x", kind: "POST" });
    expect(m.status).toBe("APPROVED");
  });
});
