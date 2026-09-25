/** Notificações push: regras puras (testadas em tests/push.test.ts). */

export const PUSH_GROUPS = {
  pm: { label: "✉️ Mensagens no PV", kinds: ["PM"], default: true },
  social: { label: "🤝 Amizades, seguidores, curtidas e matches", kinds: ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FOLLOW", "MATCH", "PROFILE_LIKE"], default: true },
  comments: { label: "💬 Comentários, respostas e menções", kinds: ["POST_COMMENT", "COMMENT_REPLY", "MENTION"], default: true },
  reactions: { label: "🔥 Reações nos seus posts e contos", kinds: ["POST_REACTION", "COMMENT_REACTION", "CONTO"], default: false },
  testimonials: { label: "📝 Depoimentos", kinds: ["TESTIMONIAL"], default: true },
  trades: { label: "🎁 Presentes, trocas e Pimentas", kinds: ["GIFT", "TRADE", "COINS_CREDITED"], default: true },
  events: { label: "🎉 Eventos e lives", kinds: ["EVENT", "LIVE"], default: true },
  account: { label: "🔐 Conta, verificação, álbum e suporte", kinds: ["VERIFICATION", "TICKET", "SYSTEM", "ALBUM_REQUEST", "ALBUM_GRANTED"], default: true },
} as const;
export type PushGroup = keyof typeof PUSH_GROUPS;
export type PushPrefs = { discreet: boolean; groups: Partial<Record<PushGroup, boolean>> };

export const DEFAULT_PREFS: PushPrefs = { discreet: true, groups: {} };

export function groupOf(kind: string): PushGroup | null {
  for (const [g, def] of Object.entries(PUSH_GROUPS)) if ((def.kinds as readonly string[]).includes(kind)) return g as PushGroup;
  return null;
}

export function readPrefs(raw: unknown): PushPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PushPrefs>;
  return { discreet: r.discreet !== false, groups: r.groups && typeof r.groups === "object" ? r.groups : {} };
}

export function wantsPush(prefs: PushPrefs, kind: string) {
  const g = groupOf(kind);
  if (!g) return false;
  return prefs.groups[g] ?? PUSH_GROUPS[g].default;
}

/**
 * Texto do push. No modo discreto (padrão) nada íntimo aparece na tela bloqueada:
 * nem nick, nem conteúdo, só o tipo de novidade.
 */
export function pushText(kind: string, full: string, discreet: boolean) {
  const g = groupOf(kind);
  const generic: Record<PushGroup, string> = {
    pm: "Você tem uma nova mensagem",
    social: "Você tem uma novidade de amizade ou paquera",
    comments: "Alguém interagiu com você",
    reactions: "Seu post recebeu reações",
    testimonials: "Você recebeu uma novidade nos depoimentos",
    trades: "Você tem uma novidade na carteira",
    events: "Tem novidade em eventos e lives",
    account: "Tem um aviso sobre a sua conta",
  };
  if (discreet || !g) return { title: "Nova notificação", body: g ? generic[g] : "Você tem uma novidade" };
  return { title: "SexPapo", body: full.slice(0, 140) };
}

/** Para onde o toque no push leva (só caminhos internos). */
export function pushUrl(kind: string, refId?: string | null, actorNick?: string | null) {
  // só caminho interno: começa com "/", sem "//" nem barra invertida (o navegador trata "\\" como "/")
  const safe = (p: string) => (p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p : "/notificacoes");
  if (kind === "PM" && actorNick) return safe(`/mensagens/${encodeURIComponent(actorNick)}`);
  if (kind === "MATCH") return "/paquera/matches";
  if (kind === "PROFILE_LIKE") return "/paquera/curtidas";
  if (kind === "TRADE" && refId) return safe(`/trocas/${refId}`);
  if (kind === "EVENT" && refId) return safe(`/eventos/${refId}`);
  if (kind === "LIVE" && refId) return safe(`/ao-vivo/${refId}`);
  if (kind === "TICKET" && refId) return safe(`/suporte/${refId}`);
  if (kind === "CONTO" && refId) return safe(`/contos/${encodeURIComponent(refId)}`);
  if (kind === "TESTIMONIAL") return refId ? safe(`/u/${encodeURIComponent(refId)}`) : "/depoimentos";
  return "/notificacoes";
}
