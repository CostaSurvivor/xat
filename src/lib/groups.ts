import { z } from "zod";
import { isCouple } from "@/lib/config";

/** Regras puras dos Grupos (testadas em tests/groups.test.ts). */

type G = { audience: string; archivedAt: Date | null };
type V = { profileType: string; role: string };

/** Ver o grupo: arquivado só a equipe; "só casais" só casais (e a equipe). */
export function canSeeGroup(g: G, v: V) {
  if (v.role !== "USER") return true;
  if (g.archivedAt) return false;
  return g.audience !== "COUPLES" || isCouple(v.profileType);
}

/** Entrar/postar: mesmas regras de ver + grupo não arquivado. */
export function joinError(g: G, v: V) {
  if (g.archivedAt) return "Este grupo foi arquivado.";
  if (g.audience === "COUPLES" && !isCouple(v.profileType) && v.role === "USER") return "Grupo exclusivo para perfis de casal.";
  return null;
}

export const groupSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,39}$/, "Endereço: 3–40 letras minúsculas, números e hífen"),
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().min(10, "Descrição muito curta").max(2000),
  emoji: z.string().trim().min(1).max(8),
  audience: z.enum(["ALL", "COUPLES"]),
});

/** Grupos iniciais (criados uma vez; depois a equipe manda pelo painel). */
export const DEFAULT_GROUPS = [
  { slug: "iniciantes", emoji: "🌱", name: "Iniciantes no meio", audience: "ALL", description: "Primeiras experiências, dúvidas e dicas sem julgamento. Pergunte à vontade: todo mundo já foi iniciante." },
  { slug: "casais-procuram-casais", emoji: "💑", name: "Casais procuram casais", audience: "COUPLES", description: "Espaço exclusivo para casais se conhecerem e combinarem encontros. Respeito e consentimento sempre." },
  { slug: "menage", emoji: "🔥", name: "Ménage e trio", audience: "ALL", description: "Para quem curte ou quer experimentar ménage. Combine limites antes e trate todos com respeito." },
  { slug: "swing-em-viagem", emoji: "✈️", name: "Swing em viagem", audience: "ALL", description: "Vai viajar? Dicas de cidades, casas e encontros pelo Brasil e pelo mundo." },
  { slug: "fetiches-e-fantasias", emoji: "🎭", name: "Fetiches e fantasias", audience: "ALL", description: "Converse sobre fetiches e fantasias entre adultos, sempre com consentimento. Nada ilegal ou envolvendo terceiros." },
  { slug: "casas-e-clubes", emoji: "🍸", name: "Casas e clubes: dicas e avaliações", audience: "ALL", description: "Avaliações e dicas de casas de swing, clubes e festas. Conte como foi a sua experiência." },
] as const;
