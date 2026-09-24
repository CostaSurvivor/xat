"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { allAdults, parseBirthDate } from "@/lib/age";
import { PROFILE_TYPES, TERMS_VERSION, UFS, type ProfileTypeKey } from "@/lib/config";
import { limiter } from "@/lib/ratelimit";
import { clientInfo, createSession, destroySession, hashPassword, sha256, verifyPassword, logAccess } from "@/server/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function acceptAgeGate(formData: FormData) {
  const next = String(formData.get("next") || "/");
  (await cookies()).set("age_ok", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180, secure: process.env.NODE_ENV === "production" });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

let _dummy: Promise<string> | undefined;
const dummyHash = () => (_dummy ??= hashPassword("dummy-password-for-timing"));

const NICK_RE = /^[A-Za-z0-9_.]{3,20}$/;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
  password: z.string().min(8, "Senha precisa de 8+ caracteres").max(200),
  nick: z.string().trim().regex(NICK_RE, "Nick: 3–20 caracteres (letras, números, _ e .)"),
  profileType: z.enum(Object.keys(PROFILE_TYPES) as [ProfileTypeKey, ...ProfileTypeKey[]]),
  state: z.enum(UFS as [string, ...string[]]),
  city: z.string().trim().min(2).max(80),
  terms: z.literal("on", { errorMap: () => ({ message: "Aceite os termos e a política de privacidade" }) }),
  sensitive: z.literal("on", { errorMap: () => ({ message: "O consentimento de dados sensíveis é obrigatório" }) }),
  adult: z.literal("on", { errorMap: () => ({ message: "Confirme que todos no perfil têm 18+" }) }),
});

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const { ip } = await clientInfo();
  if (!limiter("signup", 5, 5 / 3600).take(ip)) return { error: "Muitas tentativas. Tente mais tarde." };

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const labels = PROFILE_TYPES[d.profileType].persons;
  const births = labels.map((_, i) => parseBirthDate(String(formData.get(`birth${i}`) || "")));
  if (births.some((b) => !b)) return { error: "Informe a data de nascimento de todas as pessoas do perfil" };
  if (!allAdults(births as Date[])) return { error: "Todas as pessoas do perfil precisam ter 18 anos ou mais." };

  const banned = await db.banFingerprint.findFirst({
    where: {
      OR: [{ kind: "EMAIL", valueHash: sha256(d.email) }, { kind: "IP", valueHash: sha256(ip) }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });
  if (banned) return { error: "Cadastro não permitido." };

  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "E-mail já cadastrado" };
  const nickTaken = await db.user.findFirst({ where: { nick: d.nick } }); // collation MySQL é case-insensitive
  if (nickTaken) return { error: "Nick já está em uso" };

  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isAdmin = admins.includes(d.email);

  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      nick: d.nick,
      birthDate: births[0]!,
      profileType: d.profileType,
      city: d.city,
      state: d.state,
      role: isAdmin ? "ADMIN" : "USER",
      ageVerification: isAdmin ? "APPROVED" : "NONE",
      ageVerifiedAt: isAdmin ? new Date() : null,
      persons: { create: labels.map((label, i) => ({ label, birthDate: births[i]! })) },
      consents: {
        create: ["TERMS", "PRIVACY", "SENSITIVE_DATA", "AGE_18"].map((kind) => ({ kind, version: TERMS_VERSION, ip })),
      },
      wallet: { create: { kind: "USER" } },
    },
  });
  await createSession(user.id);
  redirect(isAdmin ? "/feed" : "/verificacao?novo=1");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const { ip } = await clientInfo();
  if (!limiter("login-ip", 20, 20 / 900).take(ip) || !limiter("login-email", 8, 8 / 900).take(email))
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword(await dummyHash(), password);
  if (!user || !ok) {
    await logAccess(user?.id ?? null, "LOGIN_FAIL");
    return { error: "E-mail ou senha incorretos" };
  }
  if (user.status === "BANNED") return { error: "Conta banida." };
  if (user.status === "DELETED") return { error: "Conta excluída." };
  await createSession(user.id);
  const next = String(formData.get("next") || "/feed");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/feed");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
