import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { PIN_LOCK, isLocked } from "@/lib/pinlock";

const COOKIE = "sid";
const SESSION_DAYS = 30;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  // argon2id (padrão da lib), parâmetros OWASP
  return hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hashStr: string, pw: string) {
  try {
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

export async function clientInfo() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || h.get("x-real-ip") || "0.0.0.0";
  // porta de ORIGEM do visitante (Marco Civil, IPs compartilhados/CGNAT). X-Forwarded-Port
  // é a porta do servidor e não serve; o proxy precisa enviar X-Client-Port / X-Real-Port.
  const port = Number(h.get("x-client-port") || h.get("x-real-port") || 0) || null;
  const deviceId = (await cookies()).get("did")?.value?.slice(0, 64) ?? null;
  return { ip, port, deviceId, userAgent: h.get("user-agent")?.slice(0, 255) ?? null };
}

export async function logAccess(userId: string | null, event: string) {
  const { ip, port, userAgent, deviceId } = await clientInfo();
  await db.accessLog.create({ data: { userId, event, ip, port, userAgent, deviceId } });
  maybeMaintenance();
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await clientInfo();
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ip,
      userAgent,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  await logAccess(userId, "LOGIN");
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  c.delete(COOKIE);
}

/** Sessão do cookie + se está travada pelo PIN (uma leitura por requisição). */
export const loadSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  const u = s.user;
  if (u.status === "BANNED" || u.status === "DELETED") return null;
  const locked = isLocked(u, s);
  // passou do tempo parado: grava o travamento (voltar a mexer não destrava sozinho)
  if (locked && !s.lockedAt) await db.session.update({ where: { id: s.id }, data: { lockedAt: new Date() } });
  return { session: s, user: u, locked };
});

/** Usuário logado, ou null (também quando a sessão está travada pelo PIN: nada vaza sem o PIN). */
export const getCurrentUser = cache(async () => {
  const st = await loadSession();
  if (!st || st.locked) return null;
  const u = st.user;
  // lastSeen a cada ~60s no máximo
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 60_000) {
    await db.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } });
  }
  return u;
});

/** Registra atividade da pessoa (páginas, ações e toques na tela; atualizações automáticas não contam). */
export async function touchActivity() {
  const st = await loadSession();
  if (!st || st.locked || !st.user.pinHash) return;
  const last = st.session.lastActiveAt?.getTime() ?? 0;
  if (Date.now() - last > PIN_LOCK.touchEverySec * 1000) await db.session.update({ where: { id: st.session.id }, data: { lastActiveAt: new Date() } });
}

/** Id da sessão atual (para prender a inscrição de push ao login deste aparelho). */
export async function currentSessionId() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true, expiresAt: true } });
  return s && s.expiresAt > new Date() ? s.id : null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const st = await loadSession();
  if (st?.locked) redirect("/desbloquear");
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  await touchActivity();
  return u;
}

export const isVerified = (u: { ageVerification: string }) => u.ageVerification === "APPROVED";
/** Assinante: pode assistir vídeos. */
export const isSubscriber = (u: { vipUntil: Date | null; role: string }) => (!!u.vipUntil && u.vipUntil > new Date()) || u.role !== "USER";
export const isStaff = (u: { role: string }) => u.role === "ADMIN" || u.role === "MODERATOR";

/** Mídia, PV com foto, compras e criação de sala exigem idade verificada. */
export async function requireVerified() {
  const u = await requireUser();
  if (!isVerified(u)) redirect("/verificacao");
  return u;
}

export async function requireStaff() {
  const u = await requireUser();
  if (!isStaff(u)) redirect("/");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

/** Para route handlers (JSON): verifica Origin em mutações (CSRF). */
export async function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Algum identificador (e-mail, IP ou dispositivo) está banido? */
export async function isFingerprintBanned(parts: { email?: string; ip?: string; deviceId?: string | null }) {
  const or = [
    parts.email ? { kind: "EMAIL", valueHash: sha256(parts.email) } : null,
    parts.ip ? { kind: "IP", valueHash: sha256(parts.ip) } : null,
    parts.deviceId ? { kind: "DEVICE", valueHash: sha256(parts.deviceId) } : null,
  ].filter(Boolean) as { kind: string; valueHash: string }[];
  if (!or.length) return false;
  return (await db.banFingerprint.count({ where: { OR: or, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] } })) > 0;
}

// Manutenção leve (sem cron na hospedagem compartilhada): no máximo 1x a cada 6h por processo.
const g = globalThis as unknown as { __maint?: number };
export function maybeMaintenance() {
  if (g.__maint && Date.now() - g.__maint < 6 * 3600_000) return;
  g.__maint = Date.now();
  const sixMonths = new Date(Date.now() - 183 * 86400_000);
  Promise.all([
    // Marco Civil art. 15: registros de acesso guardados por 6 meses
    db.accessLog.deleteMany({ where: { createdAt: { lt: sixMonths } } }),
    // pedidos Pix abandonados
    db.payment.updateMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 3 * 86400_000) } }, data: { status: "EXPIRED" } }),
    // presença antiga nas salas e sessões vencidas
    db.roomPresence.deleteMany({ where: { lastSeenAt: { lt: new Date(Date.now() - 86400_000) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    // "quem visitou meu perfil": guardado por 90 dias
    db.profileVisit.deleteMany({ where: { lastAt: { lt: new Date(Date.now() - 90 * 86400_000) } } }),
    // stories vencidos: a foto some depois de 7 dias (moderação)
    import("@/server/stories").then((m) => m.purgeOldStories()),
  ]).catch(() => {});
}
