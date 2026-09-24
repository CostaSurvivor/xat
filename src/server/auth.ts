import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";

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
  const port = Number(h.get("x-forwarded-port") || h.get("x-real-port") || 0) || null;
  return { ip, port, userAgent: h.get("user-agent")?.slice(0, 255) ?? null };
}

export async function logAccess(userId: string | null, event: string) {
  const { ip, port, userAgent } = await clientInfo();
  await db.accessLog.create({ data: { userId, event, ip, port, userAgent } });
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

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  const u = s.user;
  if (u.status === "BANNED" || u.status === "DELETED") return null;
  // lastSeen a cada ~60s no máximo
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 60_000) {
    await db.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } });
  }
  return u;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export const isVerified = (u: { ageVerification: string }) => u.ageVerification === "APPROVED";
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
