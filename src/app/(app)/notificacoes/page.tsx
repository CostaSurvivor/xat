import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { PROFILE_TYPES } from "@/lib/config";
import { requireUser } from "@/server/auth";
import { friendIds } from "@/server/friends";
import { stylesFor } from "@/server/styles";
import { respondFriendRequest } from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";

export const metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  TESTIMONIAL: "📝",
  MATCH: "💘",
  PROFILE_LIKE: "💘",
  LIVE: "🔴",
  EVENT: "🎉",
  TICKET: "🎫",
  TRADE: "🔄",
  FOLLOW: "👀", FRIEND_REQUEST: "🤝", FRIEND_ACCEPTED: "🤝", POST_REACTION: "🔥", POST_COMMENT: "💬", COMMENT_REPLY: "↩️",
  COMMENT_REACTION: "❤️", MENTION: "@", ALBUM_REQUEST: "🔒", ALBUM_GRANTED: "🔓", GIFT: "🎁", COINS_CREDITED: "🌶️", VERIFICATION: "✅", SYSTEM: "📢",
};

export default async function Notificacoes({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireUser();
  const { aba = "tudo" } = await searchParams;
  const [list, requests, fIds] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 80 }),
    db.friendship.findMany({ where: { addresseeId: user.id, status: "PENDING" }, include: { requester: { select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true } } }, orderBy: { createdAt: "desc" } }),
    friendIds(user.id),
  ]);
  const actorIds = [...new Set(list.map((n) => n.actorId).filter(Boolean) as string[])];
  const [actors, friends] = await Promise.all([
    db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, nick: true, avatarId: true } }),
    aba === "amigos" ? db.user.findMany({ where: { id: { in: fIds }, status: "ACTIVE" }, select: { id: true, nick: true, avatarId: true, profileType: true, lastSeenAt: true } }) : Promise.resolve([]),
  ]);
  const styles = await stylesFor([...actorIds, ...requests.map((r) => r.requesterId), ...friends.map((f) => f.id)]);
  const actorOf = new Map(actors.map((a) => [a.id, a]));
  const unread = list.filter((n) => !n.readAt).length;
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });

  const href = (n: (typeof list)[number]) => {
    const nick = n.actorId ? actorOf.get(n.actorId)?.nick : null;
    if (["POST_REACTION", "POST_COMMENT", "COMMENT_REPLY", "COMMENT_REACTION"].includes(n.kind) && nick) return `/u/${nick}`;
    if (n.kind === "ALBUM_REQUEST") return "/perfil";
    if (n.kind === "COINS_CREDITED") return "/carteira";
    if (n.kind === "GIFT") return "/loja/inventario";
    if (n.kind === "VERIFICATION") return "/verificacao";
    if (n.kind === "FRIEND_REQUEST") return "/notificacoes?aba=pedidos";
    if (n.kind === "TICKET" && n.refId) return `/suporte/${n.refId}`;
    if (n.kind === "MENTION" && n.refId) return `/${n.refId}`;
    if (n.kind === "TRADE" && n.refId) return `/trocas/${n.refId}`;
    if (n.kind === "LIVE" && n.refId) return `/ao-vivo/${n.refId}`;
    if (n.kind === "MATCH") return "/paquera/matches";
    if (n.kind === "PROFILE_LIKE") return "/paquera/curtidas";
    if (n.kind === "CONTO" && n.refId) return `/contos/${n.refId}`;
    if (n.kind === "TESTIMONIAL") return n.refId ? `/u/${n.refId}` : "/depoimentos";
    if (n.kind === "EVENT" && n.refId) return `/eventos/${n.refId}`;
    return nick ? `/u/${nick}` : "#";
  };

  const tabs: [string, string][] = [["tudo", `Tudo${unread ? ` (${unread})` : ""}`], ["pedidos", `Pedidos de amizade${requests.length ? ` (${requests.length})` : ""}`], ["amigos", `Amigos (${fIds.length})`]];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">Avisos</h1>
        {!(await db.pushSubscription.count({ where: { userId: user.id } })) && <Link href="/perfil#notificacoes-celular" className="btn-ghost py-1 text-xs">📲 Receber no celular</Link>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/notificacoes?aba=${k}`} className={`rounded-full px-3 py-1 text-sm ${aba === k ? "bg-wine text-white" : "border border-line text-mute hover:text-fg"}`}>{l}</Link>
        ))}
      </div>

      {(aba === "tudo" || aba === "pedidos") && requests.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="px-4 py-2 text-sm font-semibold text-gold">🤝 Pedidos de amizade</h2>
          {requests.map((r) => (
            <div key={r.requesterId} className="flex items-center gap-3 p-3">
              <Avatar mediaId={r.requester.avatarId} nick={r.requester.nick} size={44} style={styles[r.requesterId]} />
              <div className="min-w-0 flex-1">
                <Nick nick={r.requester.nick} style={styles[r.requesterId]} />
                <p className="text-xs text-mute">{PROFILE_TYPES[r.requester.profileType].label}{!r.requester.hideCity && r.requester.city ? ` · ${r.requester.city}/${r.requester.state}` : ""} · {timeAgo(r.createdAt)}</p>
              </div>
              <form action={respondFriendRequest.bind(null, r.requesterId, true)}><button className="btn-gold py-1 text-xs">Aceitar</button></form>
              <form action={respondFriendRequest.bind(null, r.requesterId, false)}><button className="btn-ghost py-1 text-xs">Recusar</button></form>
            </div>
          ))}
        </section>
      )}
      {aba === "pedidos" && requests.length === 0 && <p className="card p-6 text-center text-sm text-mute">Nenhum pedido pendente.</p>}

      {aba === "amigos" && (
        <section className="card divide-y divide-line">
          {friends.length === 0 && <p className="p-6 text-center text-sm text-mute">Vocês ainda não têm amigos aqui. Visite perfis e toque em “Adicionar amigo”.</p>}
          {friends.map((f) => {
            const on = f.lastSeenAt && Date.now() - f.lastSeenAt.getTime() < 5 * 60_000;
            return (
              <div key={f.id} className="flex items-center gap-3 p-3">
                <span className="relative">
                  <Avatar mediaId={f.avatarId} nick={f.nick} size={40} style={styles[f.id]} />
                  {on && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-green-500" />}
                </span>
                <div className="min-w-0 flex-1"><Nick nick={f.nick} style={styles[f.id]} /><p className="text-xs text-mute">{PROFILE_TYPES[f.profileType].label}{on ? " · online" : ""}</p></div>
                <Link href={`/mensagens/${f.nick}`} className="btn-wine py-1 text-xs">✉️ PV</Link>
              </div>
            );
          })}
        </section>
      )}

      {aba === "tudo" && (
        <section className="card divide-y divide-line">
          {list.length === 0 && <p className="p-6 text-center text-mute">Nada por aqui ainda.</p>}
          {list.map((n) => {
            const actor = n.actorId ? actorOf.get(n.actorId) : null;
            return (
              <Link key={n.id} href={href(n)} className={`flex items-center gap-3 p-3 text-sm hover:bg-black/5 ${!n.readAt ? "bg-wine/15" : ""}`}>
                <span className="relative">
                  {actor ? <Avatar mediaId={actor.avatarId} nick={actor.nick} size={38} style={styles[actor.id]} /> : <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-panel2 text-lg">{ICON[n.kind] ?? "🔔"}</span>}
                  {actor && <span className="absolute -bottom-1 -right-1 rounded-full bg-panel px-0.5 text-xs">{ICON[n.kind] ?? "🔔"}</span>}
                </span>
                <span className="flex-1">{n.text}</span>
                <span className="text-xs text-mute">{timeAgo(n.createdAt)}</span>
                {!n.readAt && <span className="h-2 w-2 rounded-full bg-wine2" />}
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
