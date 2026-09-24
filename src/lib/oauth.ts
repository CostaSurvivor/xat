/** Regras puras do login com Google (testadas em tests/oauth.test.ts). */

export const NO_PASSWORD = "!oauth"; // hash impossível: conta criada pelo Google, ainda sem senha
export const hasPassword = (u: { passwordHash: string }) => u.passwordHash !== NO_PASSWORD;

export type IdClaims = { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: boolean | string; exp?: number; nonce?: string; name?: string };

export function decodeJwtPayload(jwt: string): IdClaims | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Valida o id_token recebido DIRETO do endpoint de token do Google (canal TLS
 * servidor→servidor, OIDC §3.1.3.7: a assinatura pode ser dispensada nesse caso).
 */
export function checkIdClaims(c: IdClaims | null, clientId: string, nonce: string, now = Date.now()): { sub: string; email: string; name?: string } | string {
  if (!c) return "token inválido";
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return "emissor inválido";
  if (c.aud !== clientId) return "audiência inválida";
  if (!c.exp || c.exp * 1000 < now) return "token expirado";
  if (!c.nonce || c.nonce !== nonce) return "nonce inválido";
  if (!c.sub || !/^[0-9]{5,64}$/.test(c.sub)) return "conta inválida";
  if (!c.email || !(c.email_verified === true || c.email_verified === "true")) return "e-mail do Google não verificado";
  return { sub: c.sub, email: c.email.toLowerCase(), name: c.name };
}

export function safeNext(next: string | null | undefined, fallback = "/feed") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
