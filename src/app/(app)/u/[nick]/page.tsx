import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PERSON_FIELDS, PROFILE_TYPES, agesLabel } from "@/lib/config";
import { distanceLabel, distanceVisible, haversineKm } from "@/lib/geo";
import { isSubscriber, isVerified, requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";
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
import { achievementsOf } from "@/server/achievements";
import { referralStats } from "@/server/referral";
import { NETWORK_TABS, networkOf, type NetworkTab } from "@/server/network";
import { AFFINITY_MIN_TAGS, affinity, affinityTier, tagsOf } from "@/lib/affinity";

export async function generateMetadata({ params }: { params: Promise<{ nick: string }> }) {
  return { title: `@${decodeURIComponent((await params).nick)}` };
}

export default async function UserPage({ params, searchParams }: { params: Promise<{ nick: string }>; searchParams: Promise<{ aba?: string }> }) {
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
  const abaRaw = (await searchParams).aba;
  const aba: NetworkTab = NETWORK_TABS.includes(abaRaw as NetworkTab) ? (abaRaw as NetworkTab) : "amigos";
  const net = iBlocked ? { total: 0, users: [] } : await networkOf(viewer, u.id, aba, 24);
  const achievements = iBlocked ? [] : await achievementsOf(u.id);
  const mine = me
    ? await Promise.all([
        import("@/server/visits").then((m) => m.visitsFor(u.id)).then((v) => v.slice(0, 10)),
        db.favorite.findMany({ where: { ownerId: u.id, target: { status: "ACTIVE" } }, orderBy: { createdAt: "desc" }, take: 8, include: { target: { select: { nick: true, avatarId: true } } } }),
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
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card p-5">
        <div className="flex items-start gap-4">
          {hasStories ? (
            <Link href={`/stories/${u.nick}`} title="Ver stories" className="shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-wine2 to-fuchsia-600 p-[3px]">
              <span className="block rounded-full bg-panel p-[2px]"><Avatar mediaId={u.avatarId} nick={u.nick} size={80} style={st} /></span>
            </Link>
          ) : (
            <Avatar mediaId={hidden ? null : u.avatarId} nick={u.nick} size={88} style={st} />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl"><Nick nick={u.nick} style={st} link={false} /> {u.ageVerification === "APPROVED" && <span title="Perfil verificado" className="text-sm text-gold">✔ verificado</span>} {isConfirmed(met) && <a href="#depoimentos" title={`${met} perfis verificados confirmaram ter conhecido pessoalmente`} className="rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-xs font-semibold text-emerald-800">🤝 Confirmado</a>} {u.vipUntil && u.vipUntil > new Date() && <span className="rounded bg-gold px-1.5 align-middle text-xs font-bold text-white">VIP</span>}</h1>
            <p className="text-sm text-mute">
              {PROFILE_TYPES[u.profileType].label} · {agesLabel(u.persons.map((p) => ({ label: p.label, age: ageOn(p.birthDate) })))}
              {!u.hideCity && u.city ? ` · ${u.city}/${u.state}` : u.state ? ` · ${u.state}` : ""}
              {top && <Link href="/destaques?aba=perfis" className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">🏆 Top {top.rank <= 3 ? top.rank : 10} da semana · {top.group}</Link>}
              {aff && !hidden && <a href="#curtem" title={affinityTier(aff.pct).label} className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${affinityTier(aff.pct).cls}`} data-testid="afinidade">🔥 {aff.pct}% de afinidade</a>}
              {!me && km != null && <span className="ml-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold text-wine">📍 {distanceLabel(km)}</span>}
            </p>
            {trip && !hidden && <Link href={me ? "/viagens" : `/viagens?uf=${trip.state}`} className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800" title={trip.note ?? undefined}>{tripLabel(trip, today)}</Link>}
            <p className="mt-1 text-xs text-mute">
              <Link href="?aba=amigos#rede" className="hover:text-wine"><b className="text-fg">{friends.length}</b> amigos</Link> ·{" "}
              <Link href="?aba=seguidores#rede" className="hover:text-wine"><b className="text-fg">{followers}</b> seguidores</Link> ·{" "}
              <Link href="?aba=seguindo#rede" className="hover:text-wine"><b className="text-fg">{following}</b> seguindo</Link>
            </p>
            {!me && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!iBlocked && fStatus === "none" && <form action={sendFriendRequest.bind(null, u.id)}><button className="btn-gold">🤝 Adicionar amigo</button></form>}
                {!iBlocked && fStatus === "sent" && <form action={removeFriend.bind(null, u.id)}><button className="btn-ghost" title="Cancelar pedido">Pedido enviado ✓</button></form>}
                {!iBlocked && fStatus === "received" && (
                  <>
                    <form action={respondFriendRequest.bind(null, u.id, true)}><button className="btn-gold">Aceitar amizade</button></form>
                    <form action={respondFriendRequest.bind(null, u.id, false)}><button className="btn-ghost">Recusar</button></form>
                  </>
                )}
                {!iBlocked && fStatus === "friends" && <form action={removeFriend.bind(null, u.id)}><button className="btn-ghost" title="Desfazer amizade">Amigos 🤝</button></form>}
                {!iBlocked && <form action={toggleFollow.bind(null, u.id)}><button className={isFollowing ? "btn-ghost" : "btn-wine"}>{isFollowing ? "Seguindo ✓" : "Seguir"}</button></form>}
                {!iBlocked && <Link href={`/mensagens/${u.nick}`} className="btn-ghost">✉️ PV</Link>}
                {!iBlocked && <GiftButton toId={u.id} toNick={u.nick} />}
                {!iBlocked && <form action={startTrade.bind(null, u.nick)}><button className="btn-ghost">🔄 Trocar</button></form>}
                <form action={toggleBlock.bind(null, u.id)}><button className="btn-ghost text-xs">{iBlocked ? "Desbloquear" : "Bloquear"}</button></form>
                <ReportButton targetType="USER" targetId={u.id} />
              </div>
            )}
            {!me && !iBlocked && <div className="mt-2"><FavoriteBox targetId={u.id} initialOn={!!fav} initialNote={fav?.note ?? null} /></div>}
            {me && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/perfil" className="btn-ghost">✏️ Editar perfil e configurações</Link>
                <Link href="/depoimentos" className="btn-ghost">📝 Depoimentos{mine?.[3] ? ` (${mine[3]} novos)` : ""}</Link>
              </div>
            )}
          </div>
        </div>
        {u.bio && !hidden && <p className="mt-4 whitespace-pre-wrap text-sm">{u.bio}</p>}
        {!hidden && u.persons.some((p) => p.heightCm || (Object.keys(PERSON_FIELDS) as (keyof typeof PERSON_FIELDS)[]).some((k) => p[k])) && (
          <div className={`mt-4 grid gap-3 ${u.persons.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {u.persons.map((p) => {
              const items = [
                ...(Object.keys(PERSON_FIELDS) as (keyof typeof PERSON_FIELDS)[]).filter((k) => p[k]).map((k) => [PERSON_FIELDS[k].label, p[k] as string]),
                ...(p.heightCm ? [["Altura", `${(p.heightCm / 100).toFixed(2).replace(".", ",")} m`]] : []),
              ];
              if (!items.length) return null;
              return (
                <div key={p.id} className="rounded-xl border border-line bg-panel2/50 p-3 text-sm">
                  <p className="mb-1 font-semibold text-gold">{u.persons.length > 1 ? `Sobre ${p.label.toLowerCase()}` : "Sobre mim"} · {ageOn(p.birthDate)} anos</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {items.map(([k, v]) => (
                      <div key={k} className="flex gap-1"><dt className="text-mute">{k}:</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        {likes.length > 0 && !hidden && (
          <div id="curtem" className="mt-3">
            {aff && aff.common.length > 0 && <p className="mb-1.5 text-xs text-mute">Vocês curtem {aff.common.length === 1 ? "1 coisa" : `${aff.common.length} coisas`} em comum (em destaque):</p>}
            <div className="flex flex-wrap gap-1.5">
              {likes.map((t) => shared.has(t)
                ? <span key={t} className="rounded-full bg-wine px-2.5 py-0.5 text-xs font-semibold text-white">✓ {t}</span>
                : <span key={t} className="rounded-full border border-wine2/60 bg-wine/20 px-2.5 py-0.5 text-xs">{t}</span>)}
            </div>
            {!me && !aff && tagsOf(viewer.likes).length < AFFINITY_MIN_TAGS && tagsOf(u.likes).length >= AFFINITY_MIN_TAGS && (
              <p className="mt-1.5 text-xs text-mute"><Link href="/perfil" className="text-wine underline">Marque o que vocês curtem</Link> para ver a afinidade com este perfil.</p>
            )}
          </div>
        )}
        {hidden && <p className="mt-4 text-sm text-mute">Este perfil só é visível para perfis verificados. <Link href="/verificacao" className="text-gold underline">Verificar agora</Link></p>}
      </section>

      {me && mine && (
        <section className="card p-4" id="visitas" aria-label="Últimas visitas">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-auto font-semibold">👀 Quem visitou por último</h2>
            <Link href="/visitas" className="text-xs text-wine underline">ver todas</Link>
          </div>
          {mine[0].length === 0 ? (
            <p className="text-sm text-mute">Ninguém visitou seu perfil nos últimos 30 dias.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {mine[0].map((v, i) =>
                isSubscriber(viewer) ? (
                  <Link key={v.id} href={`/u/${encodeURIComponent(v.nick)}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
                    <Avatar mediaId={v.avatarId} nick={v.nick} size={52} style={v.style} />
                    <span className="w-full truncate text-center text-[11px]">{v.nick}</span>
                  </Link>
                ) : (
                  <span key={i} className="flex w-16 shrink-0 flex-col items-center gap-1" aria-hidden>
                    <span className="h-[52px] w-[52px] rounded-full bg-gradient-to-br from-pink-200 to-wine/40 blur-[2px]" />
                    <span className="h-2.5 w-10 rounded bg-panel2" />
                  </span>
                ),
              )}
            </div>
          )}
          {!isSubscriber(viewer) && mine[0].length > 0 && <p className="mt-2 text-xs text-mute">Ver <b>quem</b> visitou é exclusivo para assinantes. <Link href="/assinar" className="text-gold underline">Assinar</Link></p>}
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
            <div className="flex gap-3 overflow-x-auto pb-1">
              {mine[1].map((f) => (
                <Link key={f.targetId} href={`/u/${encodeURIComponent(f.target.nick)}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <Avatar mediaId={f.target.avatarId} nick={f.target.nick} size={52} />
                  <span className="w-full truncate text-center text-[11px]">{f.target.nick}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {!iBlocked && !hidden && (
        <section className="card p-4" id="rede" aria-label="Rede">
          <div className="mb-3 flex flex-wrap gap-2">
            {NETWORK_TABS.map((t) => (
              <Link key={t} href={`?aba=${t}#rede`} scroll={false} aria-current={aba === t ? "page" : undefined}
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

      {!iBlocked && !hidden && album.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-gold">🔒 Álbum privado ({album.length})</h2>
            {!canSeeAlbum && (access ? <span className="text-xs text-mute">Pedido enviado</span> : <form action={requestAlbum.bind(null, u.id)}><button className="btn-wine text-xs">Pedir acesso</button></form>)}
            {!canSeeAlbum && u.albumVisibility !== "PRIVATE" && <span className="w-full text-[11px] text-mute">{u.albumVisibility === "FRIENDS" ? "Liberado para amigos." : "Liberado para seguidores."}</span>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {album.slice(0, canSeeAlbum ? 30 : 6).map((m) => <ProtectedImage key={m.id} id={m.id} className="aspect-square rounded-lg" />)}
          </div>
        </section>
      )}

      {!iBlocked && !hidden && !me && <ThemedAlbumsViewer owner={{ id: u.id, nick: u.nick }} viewerId={viewer.id} viewerVerified={isVerified(viewer)} />}

      {!iBlocked && !hidden && contos.total > 0 && (
        <section className="space-y-2" aria-label="Contos">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-semibold">📖 Contos de @{u.nick} ({contos.total})</h2>
            {contos.total > 3 && <Link href={`/contos?autor=${encodeURIComponent(u.nick)}`} className="text-xs text-mute underline">ver todos</Link>}
          </div>
          {contos.items.slice(0, 3).map((c) => <ContoCard key={c.id} c={c} compact />)}
        </section>
      )}
      {!iBlocked && !hidden && <TestimonialsSection profile={{ id: u.id, nick: u.nick }} viewer={viewer} />}

      {!hidden && posts.map((p) => <PostCard key={p.id} post={p} viewer={{ nick: viewer.nick, subscriber: isSubscriber(viewer) }} />)}
    </div>
  );
}
