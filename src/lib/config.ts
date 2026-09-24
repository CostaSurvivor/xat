export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "SexPapo";
export const CURRENCY_NAME = process.env.NEXT_PUBLIC_CURRENCY_NAME || "Pimentas";
export const CURRENCY_ICON = "🌶️";

// Pix manual (chave estática). Configurado via variáveis de ambiente.
export const PIX = {
  key: process.env.PIX_KEY || "",
  merchantName: process.env.PIX_MERCHANT_NAME || SITE_NAME,
  merchantCity: process.env.PIX_MERCHANT_CITY || "SAO PAULO",
};

export const TERMS_VERSION = "2026-09";

export const PROFILE_TYPES = {
  COUPLE_MF: { label: "Casal (H/M)", persons: ["Ele", "Ela"] },
  COUPLE_MM: { label: "Casal (H/H)", persons: ["Ele", "Ele"] },
  COUPLE_FF: { label: "Casal (M/M)", persons: ["Ela", "Ela"] },
  SINGLE_WOMAN: { label: "Mulher", persons: ["Ela"] },
  SINGLE_MAN: { label: "Homem", persons: ["Ele"] },
  TRANS: { label: "Trans", persons: ["Pessoa"] },
  OTHER: { label: "Outro", persons: ["Pessoa"] },
} as const;
export type ProfileTypeKey = keyof typeof PROFILE_TYPES;
export const isCouple = (t: string) => t.startsWith("COUPLE_");

/** Gostos agrupados (perfil e filtro de busca). */
export const LIKE_GROUPS: { title: string; tags: string[] }[] = [
  { title: "Ménage", tags: ["Ménage masculino (2 homens + 1 mulher)", "Ménage feminino (2 mulheres + 1 homem)"] },
  { title: "Interação (casais)", tags: ["Interação com ele", "Interação com ela", "Interação com ele e ela", "Só ela interage", "Só ele interage"] },
  { title: "Orientação", tags: ["Hétero", "Bi masculino", "Bi feminino", "Casal bi (os dois)"] },
  { title: "Estilo", tags: ["Troca de casais", "Soft swing", "Full swap", "Mesmo quarto", "Voyeur", "Exibicionismo", "Cuckold", "Hotwife", "BDSM leve", "Fetiches", "Nudismo"] },
  { title: "Como e onde", tags: ["Casa de swing", "Encontros em motel", "Festas liberais", "Virtual", "Só conversa", "Amizade liberal"] },
];

export const LIKE_TAGS = LIKE_GROUPS.flatMap((g) => g.tags);

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "sair", "cadastro", "entrada", "feed", "u", "salas", "mensagens",
  "loja", "carteira", "perfil", "conta", "verificacao", "notificacoes", "termos", "privacidade",
  "regras", "_next", "static", "favicon.ico", "robots.txt", "denunciar", "busca", "pessoas",
  "ao-vivo", "live", "trocas", "suporte", "assinar",
]);

export const REACTIONS = ["🔥", "❤️", "😈", "😂", "👏", "😍"] as const;

/** Características opcionais de cada pessoa do perfil (sobre ela / sobre ele). */
export const PERSON_FIELDS = {
  orientation: { label: "Orientação", options: ["Hétero", "Bi", "Bi-curioso(a)", "Gay", "Lésbica", "Pan"] },
  body: { label: "Corpo", options: ["Magro(a)", "Atlético(a)", "Normal", "Com curvas", "Gordinho(a)", "Plus size", "Musculoso(a)"] },
  skin: { label: "Pele", options: ["Branca", "Morena", "Parda", "Negra", "Amarela", "Indígena"] },
  hair: { label: "Cabelo", options: ["Loiro", "Castanho", "Preto", "Ruivo", "Grisalho", "Colorido", "Careca/raspado"] },
  eyes: { label: "Olhos", options: ["Castanhos", "Pretos", "Verdes", "Azuis", "Mel"] },
  tattoos: { label: "Tatuagens", options: ["Não", "Poucas", "Várias"] },
  smoker: { label: "Fuma", options: ["Não", "Socialmente", "Sim"] },
  drinks: { label: "Bebe", options: ["Não", "Socialmente", "Sim"] },
} as const;
export type PersonFieldKey = keyof typeof PERSON_FIELDS;

/** "36 anos" para solteiros; "Ele 34 · Ela 32" para casais. */
export function agesLabel(persons: { label: string; age: number }[]) {
  if (persons.length === 1) return `${persons[0].age} anos`;
  return persons.map((p) => `${p.label} ${p.age}`).join(" · ");
}
