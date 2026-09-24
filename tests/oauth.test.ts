import { describe, expect, it } from "vitest";
import { checkIdClaims, decodeJwtPayload, hasPassword, NO_PASSWORD, safeNext } from "@/lib/oauth";

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
const base = { iss: "https://accounts.google.com", aud: "cid", sub: "1234567890", email: "Casal@Gmail.com", email_verified: true, exp: Math.floor(Date.now() / 1000) + 300, nonce: "n1" };

describe("login com Google", () => {
  it("aceita id_token válido e normaliza o e-mail", () => {
    expect(checkIdClaims(decodeJwtPayload(jwt(base)), "cid", "n1")).toEqual({ sub: "1234567890", email: "casal@gmail.com", name: undefined });
  });
  it("recusa emissor, audiência, nonce, expiração e e-mail não verificado", () => {
    const bad = (o: object) => typeof checkIdClaims(decodeJwtPayload(jwt({ ...base, ...o })), "cid", "n1") === "string";
    expect(bad({ iss: "https://evil.com" })).toBe(true);
    expect(bad({ aud: "outro" })).toBe(true);
    expect(bad({ nonce: "n2" })).toBe(true);
    expect(bad({ exp: 1 })).toBe(true);
    expect(bad({ email_verified: false })).toBe(true);
    expect(bad({ sub: "../x" })).toBe(true);
    expect(checkIdClaims(decodeJwtPayload("lixo"), "cid", "n1")).toBeTypeOf("string");
  });
  it("não deixa redirecionar para fora do site", () => {
    expect(safeNext("/feed")).toBe("/feed");
    expect(safeNext("//evil.com")).toBe("/feed");
    expect(safeNext("/\\evil.com")).toBe("/feed");
    expect(safeNext("https://evil.com")).toBe("/feed");
    expect(safeNext(null)).toBe("/feed");
    expect(safeNext("/\t/evil.com")).toBe("/feed");
    expect(safeNext("/\n/evil.com")).toBe("/feed");
    expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com"); // codificado: fica no próprio site
    expect(safeNext("/salas?uf=SP#x")).toBe("/salas?uf=SP#x");
    expect(safeNext("/ao-vivo/abc", "/")).toBe("/ao-vivo/abc");
  });
  it("conta criada pelo Google começa sem senha", () => {
    expect(hasPassword({ passwordHash: NO_PASSWORD })).toBe(false);
    expect(hasPassword({ passwordHash: "$argon2id$..." })).toBe(true);
  });
});
