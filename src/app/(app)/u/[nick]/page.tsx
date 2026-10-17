import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PERSON_FIELDS, PROFILE_TYPES, agesLabel } from "@/lib/config";
import { distanceLabel, distanceVisible, haversineKm } from "@/lib/geo";
import { isSubscriber, isVerified, requireUser } from "@/server/auth";
import { blockedIds, isBlockedBetween } from "@/server/access";
import { getFeed } from "@/server/feed";
import { stylesFor } from "@/server/styles";
import { removeFriend, requestAlbum, respondFriendRequest, sendFriendRequest, toggleBlock, toggleFollow } from "@/app/actions/profile";
import { friendIds, friendStatus } from "@/server/friends";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { PostCard } from "@/components/PostCard";
import { ProtectedImage } from "@/components/ProtectedImage";
import { ReportButton } from "@/components/ReportButton";
import { GiftButton } from "@/components/GiftButton";
import { startTrade } from "@/app/actions/trade";
import { recordVisit } from "@/server/visits";
import { TestimonialsSection } from "@/components/Testimonials";
import { ThemedAlbumsViewer } from "@/components/ThemedAlbums";
import { todayBR, tripLabel } from "@/lib/trips";
import { profileTrip } from "@/server/trips";
import { listContos } from "@/server/contos";
import { ContoCard } from "@/components/ContoCard";
import { FavoriteBox } from "@/components/Favorite";
import { InviteCard } from "@/components/InviteCard";
import { Achievements } from "@/components/Achievements";
import { AfimToggle } from "@/components/AfimToggle";
import { completeness, lastSeenLabel, memberSince } from "@/lib/profileInfo";
import { afimUntilLabel, isAfim } from "@/lib/afim";
import { achievementsOf } from "@/server/achievements";
import { referralStats } from "@/server/referral";
import { NETWORK_TABS, networkOf, type NetworkTab } from "@/server/network";
import { AFFINITY_MIN_TAGS, affinity, affinityTier, tagsOf } from "@/lib/affinity";

export async function generateMetadata({ params }: { params: Promise<{ nick: string }> }) {
  return { title: `@${decodeURIComponent((await params).nick)}` };
}

export default async function UserPage({ params, searchParams }: { params: Promise<{ nick: string }>; searchParams: Promise<{ aba?: string; secao?: string }> }) {
  const viewer = await requireUser();
  const nick = decodeURIComponent((await params).nick);
  const u = await db.user.findFirst({ where: { nick }, include: { persons: true } });
  if (!u || u.status === "DELETED" || u.status === "BANNED") notFound();
  const me = u.id === viewer.id;
  const iBlocked = await db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: u.id } } });
  if (!me && !iBlocked && (await isBlockedBetween(viewer.id, u.id))) notFound();
  if (!me && !iBlocked) await recordVisit(viewer, u.id);

  const today = todayBR();
  const [fStatus, friends, trip, contos] = await Promise.all([
    friendStatus(viewer.id, u.id),
    friendIds(u.id),
    profileTrip(u.id, today),
    listContos(viewer, { order: "populares", page: 1, authorId: u.id }),
  ]);
  const fav = me ? null : await db.favorite.findUnique({ where: { ownerId_targetId: { ownerId: viewer.id, targetId: u.id } } });
  // rede (amigos / seguidores / seguindo) e, no próprio perfil, visitas, favoritos e depoimentos pendentes
  const sp = await searchParams;
  const abaRaw = sp.aba;
  // abas do perfil (como numa rede social): uma seção por vez na coluna principal
  const SECOES = ["publicacoes", "sobre", "fotos", "amigos", "depoimentos", "contos"] as const;
  type Secao = (typeof SECOES)[number];
  const secao: Secao = SECOES.includes(sp.secao as Secao) ? (sp.secao as Secao) : "publicacoes";
  const aba: NetworkTab = NETWORK_TABS.includes(abaRaw as NetworkTab) ? (abaRaw as NetworkTab) : "amigos";
  const skipHeavy = iBlocked || (u.hideFromUnverified && !isVerified(viewer) && !me);
  const net = skipHeavy ? { total: 0, users: [] } : await networkOf(viewer, u.id, aba, 24);
  const achievements = skipHeavy ? [] : await achievementsOf(u.id);
  const mine = me
    ? await Promise.all([
        import("@/server/visits").then((m) => m.visitsFor(u.id)).then((v) => v.slice(0, 10)),
        blockedIds(u.id).then((blocked) =>
          db.favorite.findMany({
            where: { ownerId: u.id, targetId: blocked.length ? { notIn: blocked } : undefined, target: { status: "ACTIVE", ...(isVerified(viewer) ? {} : { hideFromUnverified: false }) } },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { target: { select: { nick: true, avatarId: true } } },
          }),
        ),
        db.favorite.count({ where: { ownerId: u.id } }),
        db.testimonial.count({ where: { profileId: u.id, status: "PENDING", withdrawnAt: null } }),
        referralStats(u.id),
      ])
    : null;
  const [followers, following, isFollowing, album, access, posts, styles] = await Promise.all([
    db.follow.count({ where: { followeeId: u.id } }),
    db.follow.count({ where: { followerId: u.id } }),
    db.follow.findUnique({ where: { followerId_followeeId: { followerId: viewer.id, followeeId: u.id } } }),
    db.media.findMany({ where: { ownerId: u.id, kind: "PRIVATE_ALBUM", status: "APPROVED", albumId: null }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    db.albumAccess.findUnique({ where: { ownerId_viewerId: { ownerId: u.id, viewerId: viewer.id } } }),
    iBlocked ? Promise.resolve([]) : getFeed(viewer, { authorId: u.id, take: 30 }),
    stylesFor([u.id]),
  ]);
  const st = styles[u.id];
  const [visitsTotal, testimonialsOk, postsCount] = await Promise.all([
    db.profileVisit.count({ where: { visitedId: u.id } }),
    db.testimonial.count({ where: { profileId: u.id, status: "APPROVED", withdrawnAt: null } }),
    me ? db.post.count({ where: { authorId: u.id, deletedAt: null } }) : Promise.resolve(0),
  ]);
  const seen = me || st?.powers.includes("INVISIBLE") ? null : lastSeenLabel(u.lastSeenAt);
  const comp = me ? completeness({ ...u, posts: postsCount }) : null;
  const likes = (u.likes as string[] | null) ?? [];
  const aff = me ? null : affinity(viewer.likes, u.likes);
  const shared = new Set(aff?.common);
  const { canSeeAlbum: albumCheck } = await import("@/server/access");
  const canSeeAlbum = me || (await albumCheck(viewer.id, u.id, u.albumVisibility, { viewerVerified: isVerified(viewer) }));
  const hidden = u.hideFromUnverified && !isVerified(viewer) && !me;
  const { weeklyTopRank } = await import("@/server/ranking");
  const top = await weeklyTopRank(u);
  const { storiesOf } = await import("@/server/stories");
  const hasStories = !iBlocked && !hidden && (await storiesOf(u.id, viewer)).length > 0;
  const met = (await import("@/server/testimonials").then((m) => m.metInPersonCounts([u.id]))).get(u.id) ?? 0;
  const { isConfirmed } = await import("@/lib/testimonials");
  const km = viewer.lat != null && viewer.lng != null && distanceVisible(u) ? haversineKm({ lat: viewer.lat, lng: viewer.lng }, { lat: u.lat!, lng: u.lng! }) : null;

  return (
    <div className="mx-auto max-w-[1000px] space-y-2">
      {/* cabeçalho: capa em degradê, avatar grande, nome, ações, números e abas */}
      <section className="card overflow-hidden" data-testid="perfil-topo">
        <div className="h-28 bg-gradient-to-r from-[#4c1d95] via-[#a21caf] to-[#db2777] sm:h-36" aria-hidden />
        <div className="px-4 pb-3 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
            <span className="rounded-full bg-panel p-1">
              {hasStories ? (
                <Link href={`/stories/${u.nick}`} title="Ver stories" className="block rounded-full bg-gradient-to-tr from-amber-400 via-wine2 to-fuchsia-600 p-[3px]">
                  <span className="block rounded-full bg-panel p-[2px]"><Avatar mediaId={u.avatarId} nick={u.nick} size={104} style={st} /></span>
                </Link>
              ) : (
                <Avatar mediaId={hidden ? null : u.avatarId} nick={u.nick} size={112} style={st} ring={u.vipUntil && u.vipUntil > new Date() ? "vip" : null} />
              )}
            </span>
            <div className="w-full min-w-0 pb-1 sm:w-auto sm:flex-1">
              <h1 className="text-xl font-bold"><Nick nick={u.nick} style={st} link={false} /> {u.ageVerification === "APPROVED" && <span title="Perfil verificado" className="text-sm text-gold">✔ verificado</span>} {isConfirmed(met) && <Link href="?secao=depoimentos" title={`${met} perfis verificados confirmaram ter conhecido pessoalmente`} className="rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-xs font-semibold text-emerald-800">🤝 Confirmado</Link>} {u.vipUntil && u.vipUntil > new Date() && <span className="rounded bg-gold px-1.5 align-middle text-xs font-bold text-white">VIP</span>}</h1>
              <p className="text-sm text-mute">
                {PROFILE_TYPES[u.profileType].label} · {agesLabel(u.persons.map((p) => ({ label: p.label, age: ageOn(p.birthDate) })))}
                {!u.hideCity && u.city ? ` · ${u.city}/${u.state}` : u.state ? ` · ${u.state}` : ""}
              </p>
              {!hidden && (
                <p className="text-xs text-mute" data-testid="membro">
                  {memberSince(u.createdAt)}
                  {seen && <> · <span className={seen === "online agora" ? "font-semibold text-green-700" : ""}>{seen}</span></>}
                </p>
              )}
            </div>
            {/* ações: Adicionar · Mensagem · … (como nas redes sociais) */}
            {!me && (
              <div className="flex flex-wrap items-center gap-2 pb-1" data-testid="acoes">
                {!iBlocked && fStatus === "none" && <form action={sendFriendRequest.bind(null, u.id)}><button className="btn-gold">🤝 Adicionar</button></form>}
                {!iBlocked && fStatus === "sent" && <form action={removeFriend.bind(null, u.id)}><button className="btn-ghost" title="Cancelar pedido">Pedido enviado ✓</button></form>}
                {!iBlocked && fStatus === "received" && (
                  <>
                    <form action={respondFriendRequest.bind(null, u.id, true)}><button className="btn-gold">Aceitar amizade</button></form>
                    <form action={respondFriendRequest.bind(null, u.id, false)}><button className="btn-ghost">Recusar</button></form>
                  </>
                )}
                {!iBlocked && fStatus === "friends" && <form action={removeFriend.bind(null, u.id)}><button className="btn-ghost" title="Desfazer amizade">Amigos 🤝</button></form>}
                {!iBlocked && <Link href={`/mensagens/${u.nick}`} className="btn-wine">✉️ Mensagem</Link>}
                <details className="relative">
                  <summary className="btn-ghost cursor-pointer list-none px-3" aria-label="Mais ações">•••</summary>
                  <div className="card absolute right-0 z-20 mt-1 flex w-56 flex-col gap-1 p-2 shadow-xl">
                    {!iBlocked && <form action={toggleFollow.bind(null, u.id)}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel2">{isFollowing ? "✓ Seguindo (deixar de seguir)" : "➕ Seguir"}</button></form>}
                    {!iBlocked && <div className="px-1"><GiftButton toId={u.id} toNick={u.nick} /></div>}
                    {!iBlocked && <form action={startTrade.bind(null, u.nick)}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel2">🔄 Propor troca</button></form>}
                    {!iBlocked && <Link href="?secao=depoimentos" className="rounded-lg px-3 py-2 text-sm hover:bg-panel2">📝 Escrever depoimento</Link>}
                    <form action={toggleBlock.bind(null, u.id)}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel2">🚫 {iBlocked ? "Desbloquear" : "Bloquear"}</button></form>
                    <div className="px-3 py-1 text-sm"><ReportButton targetType="USER" targetId={u.id} /></div>
                  </div>
                </details>
              </div>
            )}
            {me && (
              <div className="flex flex-wrap gap-2 pb-1">
                <Link href="/perfil" className="btn-ghost">✏️ Editar perfil</Link>
                <Link href="/estatisticas" className="btn-ghost" data-testid="link-estatisticas">📊 Estatísticas</Link>
                <Link href="/depoimentos" className="btn-ghost">📝 Depoimentos{mine?.[3] ? ` (${mine[3]} novos)` : ""}</Link>
              </div>
            )}
          </div>
          {(top || (aff && !hidden) || (!me && km != null) || (trip && !hidden)) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {top && <Link href="/destaques?aba=perfis" className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">🏆 Top {top.rank <= 3 ? top.rank : 10} da semana · {top.group}</Link>}
              {aff && !hidden && <Link href="?secao=sobre" title={affinityTier(aff.pct).label} className={`rounded-full px-2 py-0.5 font-semibold ${affinityTier(aff.pct).cls}`} data-testid="afinidade">🔥 {aff.pct}% de afinidade</Link>}
              {!me && km != null && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-wine">📍 {distanceLabel(km)}</span>}
              {trip && !hidden && <Link href={me ? "/viagens" : `/viagens?uf=${trip.state}`} className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-800" title={trip.note ?? undefined}>{tripLabel(trip, today)}</Link>}
            </div>
          )}
          {isAfim(u) && !hidden && !me && (
            <div className="mt-2 rounded-lg bg-wine px-3 py-1.5 text-sm text-white" data-testid="afim-perfil">
              <b>🔥 Afim hoje</b> <span className="opacity-80">· {afimUntilLabel(u.afimUntil!)}</span>
              {u.afimNote && <span className="block italic">“{u.afimNote}”</span>}
            </div>
          )}
          {u.bio && !hidden && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm">{u.bio}</p>}
          <div className="mt-3 grid max-w-md grid-cols-4 gap-1 border-t border-line pt-2 text-center" data-testid="contadores">
            {[
              { n: friends.length, label: "amigos", href: "?secao=amigos&aba=amigos" },
              { n: followers, label: "seguidores", href: "?secao=amigos&aba=seguidores" },
              { n: visitsTotal, label: "visitas", href: me ? "/estatisticas" : null },
              { n: testimonialsOk, label: "depoimentos", href: "?secao=depoimentos" },
            ].map((c) => {
              const inner = <><b className="block text-base leading-tight text-fg">{c.n.toLocaleString("pt-BR")}</b><span className="text-[11px] text-mute">{c.label}</span></>;
              return c.href ? <Link key={c.label} href={c.href} className="rounded-lg py-1 hover:bg-panel2">{inner}</Link> : <div key={c.label} className="py-1">{inner}</div>;
            })}
          </div>
        </div>
        {!iBlocked && !hidden && (
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 [scrollbar-width:none]" aria-label="Seções do perfil" data-testid="secoes">
            {([
              ["publicacoes", "Publicações"],
              ["sobre", "Sobre"],
              ["fotos", "Fotos"],
              ["amigos", "Amigos"],
              ["depoimentos", "Depoimentos"],
              ...(contos.total > 0 ? [["contos", "Contos"]] : []),
            ] as [Secao, string][]).map(([k, label]) => (
              <Link key={k} href={`?secao=${k}`} scroll={false} aria-current={secao === k ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${secao === k ? "border-wine2 text-wine2" : "border-transparent text-mute hover:text-fg"}`}>
                {label}
              </Link>
            ))}
          </nav>
        )}
        {hidden && <p className="border-t border-line px-6 py-3 text-sm text-mute">Este perfil só é visível para perfis verificados. <Link href="/verificacao" className="text-gold underline">Verificar agora</Link></p>}
      </section>

      <div className="grid gap-2 lg:grid-cols-[672px_minmax(0,1fr)]">
        {/* coluna principal: a aba escolhida */}
        <div className="min-w-0 space-y-2" data-testid={`secao-${secao}`}>
          {!iBlocked && !hidden && secao === "publicacoes" && (
            posts.length > 0
              ? posts.map((p) => <PostCard key={p.id} post={p} viewer={{ nick: viewer.nick, subscriber: isSubscriber(viewer) }} />)
              : <p className="card p-8 text-center text-sm text-mute">{me ? "Você ainda não publicou nada. " : "Nenhuma publicação ainda."}{me && <Link href="/feed#publicar" className="text-wine underline">Publicar agora</Link>}</p>
          )}

          {!iBlocked && !hidden && secao === "sobre" && (
            <section className="card space-y-4 p-4" id="sobre">
              {u.bio && <div><h2 className="mb-1 font-semibold">Apresentação</h2><p className="whitespace-pre-wrap text-sm">{u.bio}</p></div>}
              {(() => {
                const keys = (Object.keys(PERSON_FIELDS) as (keyof typeof PERSON_FIELDS)[]).filter((k) => u.persons.some((p) => p[k]));
                const rows: [string, string[]][] = [
                  ["Idade", u.persons.map((p) => `${ageOn(p.birthDate)} anos`)],
                  ...keys.map((k) => [PERSON_FIELDS[k].label, u.persons.map((p) => (p[k] as string | null) ?? "—")] as [string, string[]]),
                  ...(u.persons.some((p) => p.heightCm) ? [["Altura", u.persons.map((p) => (p.heightCm ? `${(p.heightCm / 100).toFixed(2).replace(".", ",")} m` : "—"))] as [string, string[]]] : []),
                ];
                return (
                  <div>
                    <h2 className="mb-2 font-semibold">{u.persons.length > 1 ? "Sobre o casal" : "Sobre mim"}</h2>
                    <table className="w-full overflow-hidden rounded-lg text-sm" data-testid="tabela-sobre">
                      {u.persons.length > 1 && (
                        <thead><tr className="bg-panel2 text-left"><th className="px-3 py-1.5 font-normal text-mute" />{u.persons.map((p) => <th key={p.id} className="px-3 py-1.5 font-semibold">{p.label}</th>)}</tr></thead>
                      )}
                      <tbody>
                        {rows.map(([k, vals], i) => (
                          <tr key={k} className={i % 2 ? "bg-panel2/60" : ""}>
                            <td className="w-32 px-3 py-1.5 text-mute">{k}</td>
                            {vals.map((v, j) => <td key={j} className="px-3 py-1.5">{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              {likes.length > 0 && (
                <div id="curtem">
                  <h2 className="mb-1 font-semibold">O que {u.persons.length > 1 ? "curtimos" : "curto"}</h2>
                  {aff && aff.common.length > 0 && <p className="mb-1.5 text-xs text-mute">Vocês curtem {aff.common.length === 1 ? "1 coisa" : `${aff.common.length} coisas`} em comum (em destaque):</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {likes.map((t) => shared.has(t)
                      ? <span key={t} className="rounded bg-wine px-2.5 py-1 text-xs font-semibold text-white">✓ {t}</span>
                      : <span key={t} className="rounded bg-panel2 px-2.5 py-1 text-xs">{t}</span>)}
                  </div>
                  {!me && !aff && tagsOf(viewer.likes).length < AFFINITY_MIN_TAGS && tagsOf(u.likes).length >= AFFINITY_MIN_TAGS && (
                    <p className="mt-1.5 text-xs text-mute"><Link href="/perfil" className="text-wine underline">Marque o que vocês curtem</Link> para ver a afinidade com este perfil.</p>
                  )}
                </div>
              )}
              <p className="text-xs text-mute">{memberSince(u.createdAt)}</p>
            </section>
          )}

          {!iBlocked && !hidden && secao === "fotos" && (
            <>
              {album.length > 0 ? (
                <section className="card p-4" id="album">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-semibold text-gold">🔒 Álbum privado ({album.length})</h2>
                    {!canSeeAlbum && (access ? <span className="text-xs text-mute">Pedido enviado</span> : <form action={requestAlbum.bind(null, u.id)}><button className="btn-wine text-xs">Pedir acesso</button></form>)}
                    {!canSeeAlbum && u.albumVisibility !== "PRIVATE" && <span className="w-full text-[11px] text-mute">{u.albumVisibility === "FRIENDS" ? "Liberado para amigos." : "Liberado para seguidores."}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {album.slice(0, canSeeAlbum ? 30 : 6).map((m) => <ProtectedImage key={m.id} id={m.id} className="aspect-square rounded-lg" />)}
                  </div>
                </section>
              ) : (
                <p className="card p-6 text-center text-sm text-mute">Nenhuma foto no álbum privado.</p>
              )}
              {!me && <ThemedAlbumsViewer owner={{ id: u.id, nick: u.nick }} viewerId={viewer.id} viewerVerified={isVerified(viewer)} />}
            </>
          )}

          {!iBlocked && !hidden && secao === "amigos" && (
            <section className="card p-4" id="rede" aria-label="Rede">
              <div className="mb-3 flex flex-wrap gap-2">
                {NETWORK_TABS.map((t) => (
                  <Link key={t} href={`?secao=amigos&aba=${t}`} scroll={false} aria-current={aba === t ? "page" : undefined}
                    className={`rounded-full px-3 py-1 text-sm ${aba === t ? "bg-wine text-white" : "border border-line text-mute hover:text-fg"}`}>
                    {t === "amigos" ? `🤝 Amigos (${friends.length})` : t === "seguidores" ? `👥 Seguidores (${followers})` : `➡️ Seguindo (${following})`}
                  </Link>
                ))}
              </div>
              {net.users.length === 0 ? (
                <p className="text-sm text-mute">{aba === "amigos" ? "Nenhum amigo para mostrar." : aba === "seguidores" ? "Nenhum seguidor para mostrar." : "Não segue ninguém ainda."}</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6" data-testid="rede">
                  {net.users.map((f) => (
                    <Link key={f.id} href={`/u/${encodeURIComponent(f.nick)}`} className="flex min-w-0 flex-col items-center gap-1">
                      <Avatar mediaId={f.avatarId} nick={f.nick} size={52} style={f.style} />
                      <span className="w-full truncate text-center text-[11px]">{f.nick}</span>
                    </Link>
                  ))}
                </div>
              )}
              {net.total > net.users.length && <p className="mt-2 text-xs text-mute">Mostrando {net.users.length} de {net.total}.</p>}
            </section>
          )}

          {!iBlocked && !hidden && secao === "depoimentos" && <TestimonialsSection profile={{ id: u.id, nick: u.nick }} viewer={viewer} />}

          {!iBlocked && !hidden && secao === "contos" && (
            <section className="space-y-2" id="contos" aria-label="Contos">
              <div className="card flex items-baseline justify-between px-4 py-3">
                <h2 className="font-semibold">📖 Contos de @{u.nick} ({contos.total})</h2>
                {contos.total > 3 && <Link href={`/contos?autor=${encodeURIComponent(u.nick)}`} className="text-xs text-mute underline">ver todos</Link>}
              </div>
              {contos.items.slice(0, 5).map((c) => <ContoCard key={c.id} c={c} compact />)}
            </section>
          )}
        </div>

        {/* coluna lateral (320px) */}
        <aside className="min-w-0 space-y-2">
          {comp && comp.pct < 100 && (
            <Link href={comp.next!.href} className="card block px-4 py-3 text-sm" data-testid="completo">
              <div className="flex items-baseline justify-between gap-2"><b>Seu perfil está {comp.pct}% completo</b><span className="text-xs text-wine">completar →</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-gradient-to-r from-wine to-gold" style={{ width: `${comp.pct}%` }} /></div>
              <p className="mt-1.5 text-xs text-mute">Próximo passo: {comp.next!.label}.</p>
            </Link>
          )}
          {me && <AfimToggle active={isAfim(u)} untilLabel={u.afimUntil ? afimUntilLabel(u.afimUntil) : undefined} note={u.afimNote} />}
          {!me && !iBlocked && <div className="card p-3"><FavoriteBox targetId={u.id} initialOn={!!fav} initialNote={fav?.note ?? null} /></div>}

          {me && mine && (
            <section className="card p-4" id="visitas" aria-label="Últimas visitas">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="mr-auto font-semibold">👀 Quem viu meu perfil</h2>
                <Link href="/visitas" className="text-xs text-wine underline">ver todas</Link>
              </div>
              {mine[0].length === 0 ? (
                <p className="text-sm text-mute">Ninguém visitou seu perfil nos últimos 30 dias.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {mine[0].map((v, i) =>
                    isSubscriber(viewer) ? (
                      <Link key={v.id} href={`/u/${encodeURIComponent(v.nick)}`} className="flex min-w-0 flex-col items-center gap-1">
                        <Avatar mediaId={v.avatarId} nick={v.nick} size={44} style={v.style} />
                        <span className="w-full truncate text-center text-[10px]">{v.nick}</span>
                      </Link>
                    ) : (
                      <span key={i} className="flex flex-col items-center gap-1" aria-hidden>
                        <span className="h-11 w-11 rounded-full bg-gradient-to-br from-violet-200 to-wine/40 blur-[2px]" />
                      </span>
                    ),
                  )}
                </div>
              )}
              {!isSubscriber(viewer) && mine[0].length > 0 && <Link href="/assinar" className="btn-gold mt-3 w-full bg-hot">Assine para ver quem visitou</Link>}
            </section>
          )}

          {!iBlocked && !hidden && <Achievements list={achievements} mine={me} />}

          {me && mine && <InviteCard nick={u.nick} stats={mine[4]} />}

          {me && mine && (
            <section className="card p-4" aria-label="Meus favoritos">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="mr-auto font-semibold">⭐ Meus favoritos <span className="text-xs font-normal text-mute">🔒 só você vê</span></h2>
                <Link href="/favoritos" className="text-xs text-wine underline">{mine[2] ? `ver todos (${mine[2]})` : "abrir"}</Link>
              </div>
              {mine[1].length === 0 ? (
                <p className="text-sm text-mute">Toque em ☆ Favoritar no perfil de alguém para guardar aqui, com anotação privada.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {mine[1].map((f) => (
                    <Link key={f.targetId} href={`/u/${encodeURIComponent(f.target.nick)}`} className="flex min-w-0 flex-col items-center gap-1">
                      <Avatar mediaId={f.target.avatarId} nick={f.target.nick} size={44} />
                      <span className="w-full truncate text-center text-[10px]">{f.target.nick}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
