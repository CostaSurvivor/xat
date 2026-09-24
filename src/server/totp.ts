import "server-only";
import { Secret, TOTP } from "otpauth";
import { SITE_NAME } from "@/lib/config";

export function newSecret() {
  return new Secret({ size: 20 }).base32;
}

export function totpFor(secret: string, label: string) {
  return new TOTP({ issuer: SITE_NAME, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

/** Aceita o código atual e o do período anterior/seguinte (relógio do celular). */
export function verifyTotp(secret: string, code: string) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  return totpFor(secret, "x").validate({ token: clean, window: 1 }) !== null;
}
