import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sha256 } from "@/server/auth";
import { siteUrl } from "@/server/mail";

/** Login com Google fica desligado até GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET existirem. */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = () => `${siteUrl()}/api/auth/google/callback`;

const FLOW_COOKIE = "g_oauth";
const PENDING_COOKIE = "oap";
const b64 = (n: number) => randomBytes(n).toString("base64url");

export type Flow = { state: string; verifier: string; nonce: string; next: string; mode: "login" | "link" };

export async function startFlow(next: string, mode: Flow["mode"]) {
  const flow: Flow = { state: b64(24), verifier: b64(48), nonce: b64(24), next, mode };
  (await cookies()).set(FLOW_COOKIE, JSON.stringify(flow), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function takeFlow(): Promise<Flow | null> {
  const c = await cookies();
  const raw = c.get(FLOW_COOKIE)?.value;
  c.delete({ name: FLOW_COOKIE, path: "/api/auth/google" });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Flow;
  } catch {
    return null;
  }
}

/** GOOGLE_TOKEN_URL só serve para testes com um Google falso local; só aceita localhost. */
function tokenUrl() {
  const t = process.env.GOOGLE_TOKEN_URL;
  return t && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(t) ? t : "https://oauth2.googleapis.com/token";
}

export async function exchangeCode(code: string, verifier: string): Promise<string | null> {
  const r = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { id_token?: string } | null;
  return j?.id_token ?? null;
}

// ---------------------------------------------------------------- pendências
export type PendingSignup = { sub: string; email: string; name?: string; next: string };
export type PendingTwoFa = { userId: string; next: string };

export async function putPending(kind: "SIGNUP" | "TWOFA", data: PendingSignup | PendingTwoFa) {
  const token = b64(32);
  await db.oAuthPending.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.oAuthPending.create({ data: { id: sha256(token), kind, data, expiresAt: new Date(Date.now() + 15 * 60_000) } });
  (await cookies()).set(PENDING_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
}

export async function getPending<T extends PendingSignup | PendingTwoFa>(kind: "SIGNUP" | "TWOFA"): Promise<{ id: string; data: T } | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const p = await db.oAuthPending.findUnique({ where: { id: sha256(token) } });
  if (!p || p.kind !== kind || p.expiresAt < new Date()) return null;
  return { id: p.id, data: p.data as T };
}

export async function clearPending(id: string) {
  await db.oAuthPending.deleteMany({ where: { id } });
  (await cookies()).delete(PENDING_COOKIE);
}
