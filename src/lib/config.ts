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

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** Salas oficiais: uma Geral para o Brasil todo + uma por estado (slug = UF minúscula). */
export const GENERAL_ROOM = { slug: "geral", name: "Geral", description: "O chat de todo o Brasil: chegue, se apresente e conheça a galera." };
export const COUPLES_ROOM = { slug: "casais", name: "Só Casais", description: "Sala exclusiva para perfis de casal (H/M, H/H e M/M).", access: "COUPLES_ONLY" as const };
/** Salas principais: só a equipe do site (admin/moderador) modera; ninguém recebe cargo de sala nelas. */
export const STAFF_ONLY_ROOMS = new Set([GENERAL_ROOM.slug, COUPLES_ROOM.slug]);
/** Descrição com sotaque regional (as demais usam o texto padrão). */
const STATE_DESCRIPTIONS: Record<string, string> = {
  RS: "Bah, tchê! O chat dos gaúchos: casais, prendas e peões liberais do Rio Grande do Sul. Chega mais e puxa um chimarrão 🧉",
  SC: "O chat de Santa Catarina: casais, solteiras e solteiros catarinenses, da serra ao litoral. 🌊",
  PR: "O chat do Paraná: casais, solteiras e solteiros paranaenses, de Curitiba ao interior. 🌲",
};
export const defaultStateDescription = (uf: string) => `Chat de ${UF_NAMES[uf]}: casais, solteiras e solteiros de ${uf}.`;
export const stateRoom = (uf: string) => ({
  slug: uf.toLowerCase(),
  name: UF_NAMES[uf],
  state: uf,
  description: STATE_DESCRIPTIONS[uf] ?? defaultStateDescription(uf),
});

/** Regiões para organizar as salas de estado. */
export const REGIONS = [
  { key: "SUL", name: "Sul", emoji: "🧉", tagline: "Bah, tchê! Gaúchos, catarinenses e paranaenses", ufs: ["RS", "SC", "PR"] },
  { key: "SUDESTE", name: "Sudeste", emoji: "🏙️", tagline: "SP, RJ, MG e ES", ufs: ["SP", "RJ", "MG", "ES"] },
  { key: "CENTRO_OESTE", name: "Centro-Oeste", emoji: "🌾", tagline: "Do Planalto ao Pantanal", ufs: ["DF", "GO", "MS", "MT"] },
  { key: "NORDESTE", name: "Nordeste", emoji: "🏖️", tagline: "Calor humano de sobra", ufs: ["BA", "PE", "CE", "RN", "PB", "AL", "SE", "PI", "MA"] },
  { key: "NORTE", name: "Norte", emoji: "🌳", tagline: "Da Amazônia para o Brasil", ufs: ["PA", "AM", "TO", "RO", "AC", "AP", "RR"] },
] as const;
export const regionOf = (uf: string | null | undefined) => REGIONS.find((r) => (r.ufs as readonly string[]).includes(uf ?? ""));

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "sair", "cadastro", "entrada", "feed", "u", "salas", "mensagens",
  "loja", "carteira", "perfil", "conta", "verificacao", "notificacoes", "termos", "privacidade",
  "regras", "_next", "static", "favicon.ico", "robots.txt", "denunciar", "busca", "pessoas",
  "ao-vivo", "live", "trocas", "suporte", "assinar", "geral", "lobby",
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
