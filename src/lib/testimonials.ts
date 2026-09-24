import { z } from "zod";

/** Regras puras dos Depoimentos (testadas em tests/testimonials.test.ts). */

export const TESTIMONIALS = {
  minChars: 20,
  maxChars: 800,
  /** depoimentos novos por pessoa por dia */
  perDay: 5,
};

export const testimonialSchema = z.object({
  body: z
    .string()
    .trim()
    .min(TESTIMONIALS.minChars, `Escreva pelo menos ${TESTIMONIALS.minChars} caracteres`)
    .max(TESTIMONIALS.maxChars, `No máximo ${TESTIMONIALS.maxChars} caracteres`)
    .refine((s) => !/https?:\/\/|www\./i.test(s), "Links não são permitidos")
    .refine((s) => !/\b\d{2}\s?9?\d{4}[-\s]?\d{4}\b/.test(s), "Não coloque telefone no depoimento"),
  metInPerson: z.boolean(),
});

type Who = { id: string; ageVerification: string; status: string };

/** Quem pode escrever: perfil verificado, não para si mesmo, sem bloqueio entre os dois. */
export function writeError(author: Who, target: Who, blocked: boolean) {
  if (author.id === target.id) return "Você não pode escrever depoimento para si mesmo.";
  if (author.ageVerification !== "APPROVED") return "Verifique seu perfil para deixar depoimentos.";
  if (target.status !== "ACTIVE" || blocked) return "Indisponível";
  return null;
}

/** Ações do dono do perfil sobre um depoimento recebido. */
export function ownerTransition(op: string, current: string): "APPROVED" | "HIDDEN" | null {
  if (op === "approve" && current !== "APPROVED") return "APPROVED";
  if (op === "hide" && current !== "HIDDEN") return "HIDDEN";
  return null;
}
