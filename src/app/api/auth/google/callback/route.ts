import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { checkIdClaims, decodeJwtPayload } from "@/lib/oauth";
import { clientInfo, createSession, getCurrentUser, isFingerprintBanned, logAccess } from "@/server/auth";
import { exchangeCode, googleEnabled, putPending, takeFlow } from "@/server/google";
import { audit } from "@/server/notify";
import { siteUrl } from "@/server/mail";

const go = (path: string) => NextResponse.redirect(`${siteUrl()}${path}`);

export async function GET(req: Request) {
  if (!googleEnabled()) return go("/login?erro=google-off");
  const url = new URL(req.url);
  const flow = await takeFlow();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!flow || !state || state !== flow.state || !code) return go("/login?erro=google-falhou");
  const { ip, deviceId } = await clientInfo();
  if (!limiter("google-cb", 20, 20 / 900).take(ip)) return go("/login?erro=muitas-tentativas");

  const idToken = await exchangeCode(code, flow.verifier);
  const claims = checkIdClaims(idToken ? decodeJwtPayload(idToken) : null, process.env.GOOGLE_CLIENT_ID!, flow.nonce);
  if (typeof claims === "string") return go("/login?erro=google-falhou");

  // vincular Google a uma conta já logada
  if (flow.mode === "link") {
    const me = await getCurrentUser();
    if (!me) return go("/login");
    const owner = await db.user.findFirst({ where: { googleSub: claims.sub }, select: { id: true } });
    if (owner && owner.id !== me.id) return go("/conta?google=em-uso");
    await db.user.update({ where: { id: me.id }, data: { googleSub: claims.sub } });
    await audit(me.id, "account.google.link", "User", me.id);
    return go("/conta?google=vinculado");
  }

  const user = await db.user.findFirst({ where: { googleSub: claims.sub } });
  if (user) {
    if (user.status === "BANNED") return go("/login?erro=banido");
    if (user.status === "DELETED") return go("/login?erro=excluida");
    if (user.role === "USER" && (await isFingerprintBanned({ deviceId }))) return go("/login?erro=bloqueado");
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      await putPending("TWOFA", { userId: user.id, next: flow.next });
      return go("/login/google");
    }
    await createSession(user.id);
    return go(flow.next);
  }

  // já existe conta com esse e-mail, mas sem Google vinculado: não vincula sozinho
  // (evita tomada de conta); a pessoa entra com senha e vincula em Conta.
  if (await db.user.findUnique({ where: { email: claims.email }, select: { id: true } })) return go("/login?erro=google-vincular");
  if (await isFingerprintBanned({ email: claims.email, ip, deviceId })) {
    await logAccess(null, "GOOGLE_SIGNUP_BLOCKED");
    return go("/login?erro=bloqueado");
  }
  await putPending("SIGNUP", { sub: claims.sub, email: claims.email, name: claims.name, next: flow.next });
  return go("/cadastro/google");
}
