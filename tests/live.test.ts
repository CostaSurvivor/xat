import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { signalAllowed, splitTip, tipError, isStale, fmtDuration } from "@/lib/live";

describe("ao vivo: regras puras", () => {
  it("valida gorjeta", () => {
    expect(tipError(10)).toBeNull();
    expect(tipError(0)).not.toBeNull();
    expect(tipError(-5)).not.toBeNull();
    expect(tipError(1.5)).not.toBeNull();
    expect(tipError("10")).not.toBeNull();
    expect(tipError(10_000_000)).not.toBeNull();
  });
  it("divide gorjeta com taxa arredondada para baixo", () => {
    expect(splitTip(100, 0)).toEqual({ host: 100, fee: 0 });
    expect(splitTip(100, 20)).toEqual({ host: 80, fee: 20 });
    expect(splitTip(7, 20)).toEqual({ host: 6, fee: 1 });
    expect(splitTip(4, 20)).toEqual({ host: 4, fee: 0 });
  });
  it("sinalização: espectador só fala com quem transmite e vice-versa", () => {
    const H = "host", V = "viewer", X = "outro";
    expect(signalAllowed("hello", V, H, H)).toBe(true);
    expect(signalAllowed("answer", V, H, H)).toBe(true);
    expect(signalAllowed("offer", V, H, H)).toBe(false); // espectador não oferece vídeo
    expect(signalAllowed("hello", V, X, H)).toBe(false); // espectador não fala com outro espectador
    expect(signalAllowed("offer", H, V, H)).toBe(true);
    expect(signalAllowed("full", H, V, H)).toBe(true);
    expect(signalAllowed("answer", H, V, H)).toBe(false);
    expect(signalAllowed("offer", H, H, H)).toBe(false);
    expect(signalAllowed("drop-table", V, H, H)).toBe(false);
  });
  it("heartbeat e duração", () => {
    expect(isStale(new Date(Date.now() - 60_000))).toBe(true);
    expect(isStale(new Date())).toBe(false);
    expect(fmtDuration(65_000)).toBe("1:05");
    expect(fmtDuration(3_725_000)).toBe("1:02:05");
  });
});

const hasDb = !!process.env.DATABASE_URL;
(hasDb ? describe : describe.skip)("ao vivo: gorjetas no ledger", async () => {
  const db = new PrismaClient();
  const L = await import("@/server/ledger");
  const Live = await import("@/server/live");
  const tag = randomBytes(4).toString("hex");
  let host: { id: string }, fan: { id: string }, streamId: string;
  const mkUser = (n: string) =>
    db.user.create({ data: { email: `${n}-${tag}@t.local`, passwordHash: "x", nick: `${n}${tag}`, birthDate: new Date("1990-01-01"), profileType: "SINGLE_WOMAN", ageVerification: "APPROVED" } });

  beforeAll(async () => {
    host = await mkUser("lh");
    fan = await mkUser("lf");
    streamId = (await db.liveStream.create({ data: { hostId: host.id, title: "teste" } })).id;
    await L.adminAdjust(fan.id, 300, fan.id, "teste", `seed-${tag}`);
  });
  afterAll(async () => {
    const ws = await db.wallet.findMany({ where: { userId: { in: [host.id, fan.id] } } });
    const txIds = (await db.ledgerEntry.findMany({ where: { walletId: { in: ws.map((w) => w.id) } } })).map((e) => e.transactionId);
    await db.ledgerEntry.deleteMany({ where: { transactionId: { in: txIds } } });
    await db.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await db.wallet.deleteMany({ where: { id: { in: ws.map((w) => w.id) } } });
    await db.liveStream.deleteMany({ where: { id: streamId } });
    await db.user.deleteMany({ where: { id: { in: [host.id, fan.id] } } });
    await db.$disconnect();
  });

  it("gorjeta move saldo, soma no total e é idempotente", async () => {
    const live = { id: streamId, hostId: host.id };
    expect(await Live.tipLive(fan.id, live, 100, "oi", `t1-${tag}`)).toBe(true);
    expect(await Live.tipLive(fan.id, live, 100, "oi", `t1-${tag}`)).toBe(false); // repetição = no-op
    expect(await L.balanceOf(fan.id)).toBe(200);
    expect(await L.balanceOf(host.id)).toBe(100);
    const s = await db.liveStream.findUniqueOrThrow({ where: { id: streamId } });
    expect(s.tipTotal).toBe(100);
    expect((await Live.topTippers(streamId))[0]).toMatchObject({ id: fan.id, total: 100 });
    expect(await db.liveMessage.count({ where: { streamId, kind: "TIP" } })).toBe(1);
  });
  it("sem saldo não passa, e não dá gorjeta para si mesmo", async () => {
    const live = { id: streamId, hostId: host.id };
    await expect(Live.tipLive(fan.id, live, 5000, "", `t2-${tag}`)).rejects.toThrow();
    await expect(Live.tipLive(host.id, live, 10, "", `t3-${tag}`)).rejects.toThrow();
    expect(await L.balanceOf(fan.id)).toBe(200);
  });
  it("transmissão encerrada não recebe gorjeta", async () => {
    await Live.endLive(streamId, "fim");
    await expect(Live.tipLive(fan.id, { id: streamId, hostId: host.id }, 10, "", `t4-${tag}`)).rejects.toThrow(/terminou/);
    expect(await L.balanceOf(fan.id)).toBe(200);
  });
});

describe("ao vivo: quem pode transmitir", async () => {
  const { canBroadcast } = await import("@/server/live");
  const u = (o: object) => ({ role: "USER", vipUntil: null, ageVerification: "APPROVED", ...o }) as never;
  it("só assinantes verificados (staff conta como assinante)", () => {
    expect(canBroadcast(u({}))?.href).toBe("/assinar");
    expect(canBroadcast(u({ vipUntil: new Date(Date.now() - 1000) }))?.href).toBe("/assinar"); // venceu
    expect(canBroadcast(u({ vipUntil: new Date(Date.now() + 86400_000), ageVerification: "PENDING" }))?.href).toBe("/verificacao");
    expect(canBroadcast(u({ vipUntil: new Date(Date.now() + 86400_000) }))).toBeNull();
    expect(canBroadcast(u({ role: "ADMIN" }))).toBeNull();
  });
});
