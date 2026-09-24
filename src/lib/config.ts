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

export const LIKE_TAGS = [
  "Troca de casais", "Ménage", "Voyeur", "Exibicionismo", "Soft swing", "Full swap",
  "Mesmo quarto", "Casa de swing", "Encontros em motel", "Cuckold", "Hotwife", "BDSM leve",
  "Fetiches", "Nudismo", "Amizade liberal", "Virtual", "Só conversa",
];

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "sair", "cadastro", "entrada", "feed", "u", "salas", "mensagens",
  "loja", "carteira", "perfil", "conta", "verificacao", "notificacoes", "termos", "privacidade",
  "regras", "_next", "static", "favicon.ico", "robots.txt", "denunciar", "busca", "pessoas",
]);

export const REACTIONS = ["🔥", "❤️", "😈", "👏", "😍"] as const;
