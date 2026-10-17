import { describe, expect, it } from "vitest";
import { applyInbox, tabOf, unreadByTab, type InboxFlags } from "@/lib/inbox";

const c = (o: Partial<InboxFlags> & { nick?: string; online?: boolean } = {}): InboxFlags => ({
  unread: false, friend: false, verified: false, favorite: false, iReplied: false, ...o, other: { nick: o.nick ?? "x", online: o.online ?? false },
});

describe("abas", () => {
  it("novo contato = não amigo e sem resposta minha", () => {
    expect(tabOf(c())).toBe("novos");
    expect(tabOf(c({ iReplied: true }))).toBe("conversas");
    expect(tabOf(c({ friend: true }))).toBe("conversas");
  });
});

describe("filtros", () => {
  const list = [
    c({ nick: "Ana", friend: true, unread: true, online: true }),
    c({ nick: "Bia", iReplied: true, verified: true }),
    c({ nick: "Caio", favorite: true, iReplied: true }),
    c({ nick: "Novo1", unread: true }),
    c({ nick: "Novo2", verified: true }),
  ];
  it("aba + filtro + busca", () => {
    expect(applyInbox(list, "conversas", "todas").map((x) => x.other.nick)).toEqual(["Ana", "Bia", "Caio"]);
    expect(applyInbox(list, "novos", "todas").map((x) => x.other.nick)).toEqual(["Novo1", "Novo2"]);
    expect(applyInbox(list, "conversas", "naolidas").map((x) => x.other.nick)).toEqual(["Ana"]);
    expect(applyInbox(list, "conversas", "online").map((x) => x.other.nick)).toEqual(["Ana"]);
    expect(applyInbox(list, "conversas", "amigos").map((x) => x.other.nick)).toEqual(["Ana"]);
    expect(applyInbox(list, "novos", "verificados").map((x) => x.other.nick)).toEqual(["Novo2"]);
    expect(applyInbox(list, "conversas", "favoritos").map((x) => x.other.nick)).toEqual(["Caio"]);
    expect(applyInbox(list, "conversas", "todas", "bi").map((x) => x.other.nick)).toEqual(["Bia"]);
  });
  it("não lidas por aba", () => {
    expect(unreadByTab(list)).toEqual({ conversas: 1, novos: 1 });
  });
});
