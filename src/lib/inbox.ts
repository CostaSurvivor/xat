/** Caixa de mensagens: abas e filtros (puros; testados em tests/inbox.test.ts). */

export type InboxFlags = { unread: boolean; friend: boolean; verified: boolean; favorite: boolean; iReplied: boolean; other: { online: boolean; nick: string } };

export const INBOX_TABS = { conversas: "Conversas", novos: "Novos contatos" } as const;
export type InboxTab = keyof typeof INBOX_TABS;

export const INBOX_FILTERS = { todas: "Todas", naolidas: "Não lidas", online: "Online", amigos: "Amigos", verificados: "Verificados", favoritos: "Favoritos" } as const;
export type InboxFilter = keyof typeof INBOX_FILTERS;

/** "Novos contatos": quem escreveu primeiro, não é amigo e ainda não teve resposta sua. */
export function tabOf(c: Pick<InboxFlags, "friend" | "iReplied">): InboxTab {
  return !c.friend && !c.iReplied ? "novos" : "conversas";
}

export function applyInbox<T extends InboxFlags>(list: T[], tab: InboxTab, filter: InboxFilter, q = "") {
  const term = q.trim().toLowerCase();
  return list.filter((c) => {
    if (tabOf(c) !== tab) return false;
    if (term && !c.other.nick.toLowerCase().includes(term)) return false;
    switch (filter) {
      case "naolidas": return c.unread;
      case "online": return c.other.online;
      case "amigos": return c.friend;
      case "verificados": return c.verified;
      case "favoritos": return c.favorite;
      default: return true;
    }
  });
}

/** Não lidas por aba (bolinha nas abas). */
export function unreadByTab(list: InboxFlags[]) {
  const r: Record<InboxTab, number> = { conversas: 0, novos: 0 };
  for (const c of list) if (c.unread) r[tabOf(c)]++;
  return r;
}
