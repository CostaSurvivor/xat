import Link from "next/link";
import type { Prisma, ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { isVerified, type CurrentUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { getFeed } from "@/server/feed";
import { stylesFor } from "@/server/styles";
import { topPhotos } from "@/server/ranking";
import { liveList } from "@/server/live";
import { Avatar } from "./Avatar";
import { Watermark } from "./Watermark";

/** Filtro do Explorar (tipo de perfil): vale para "Online agora" e "Últimas fotos". */
export const EXPLORE_TYPES = {
  "": { label: "Todos", types: null },
  casais: { label: "Casais", types: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] },
  mulheres: { label: "Mulheres", types: ["SINGLE_WOMAN"] },
  homens: { label: "Homens", types: ["SINGLE_MAN"] },
  trans: { label: "Trans", types: ["TRANS"] },
} as const;
export type ExploreType = keyof typeof EXPLORE_TYPES;

const ONLINE_MS = 5 * 60_000;

/** "Online agora": total + carrossel com anel (🔴 LIVE para quem está transmitindo). */
export async function ExploreOnline({ user, tipo }: { user: CurrentUser; tipo: ExploreType }) {
  const blocked = await blockedIds(user.id);
  const types = EXPLORE_TYPES[tipo].types;
  const where: Prisma.UserWhereInput = {
    status: "ACTIVE",
    id: { notIn: [...blocked, user.id] },
    lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) },
    ...(types ? { profileType: { in: types as unknown as ProfileType[] } } : {}),
    ...(isVerified(user) ? {} : { hideFromUnverified: false }),
  };
  const [rows, lives] = await Promise.all([
    db.user.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: 80, select: { id: true, nick: true, avatarId: true } }),
    liveList(),
  ]);
  const styles = await stylesFor(rows.map((r) => r.id));
  const visible = rows.filter((r) => !styles[r.id]?.powers.includes("INVISIBLE"));
  const liveBy = new Map(lives.map((l) => [l.host.id, l.id]));
  // quem está ao vivo vem primeiro
  const list = [...visible.filter((u) => liveBy.has(u.id)), ...visible.filter((u) => !liveBy.has(u.id))].slice(0, 24);
  return (
    <section className="card min-w-0 p-3" aria-label="Online agora" data-testid="explorar-online">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-semibold">🟢 Online agora <span className="text-sm font-normal text-mute">({visible.length.toLocaleString("pt-BR")})</span></h2>
        <Link href="/pessoas?on=1&raio=br" className="text-xs text-mute underline">ver todos</Link>
      </div>
      {list.length === 0 ? (
        <p className="px-1 text-sm text-mute">Ninguém online com esse filtro agora.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {list.map((u) => {
            const live = liveBy.get(u.id);
            return (
              <Link key={u.id} href={live ? `/ao-vivo/${live}` : `/u/${encodeURIComponent(u.nick)}`} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
                <span className={`relative rounded-full p-[2.5px] ${live ? "bg-green-500" : "bg-gradient-to-tr from-wine2 via-fuchsia-600 to-hot"}`}>
                  <span className="block rounded-full bg-panel p-[2px]"><Avatar mediaId={u.avatarId} nick={u.nick} size={56} style={styles[u.id]} /></span>
                  {live && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-green-600 px-1 text-[9px] font-bold uppercase text-white">Live</span>}
                </span>
                <span className="w-full truncate text-center text-[11px]">{u.nick}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** "Top da semana": mosaico com uma foto grande e quatro pequenas. */
export async function ExploreTop({ user }: { user: CurrentUser }) {
  const items = (await topPhotos(user, 7, undefined, 4)).slice(0, 4);
  if (!items.length) return null;
  const photo = (p: (typeof items)[number]["post"]) => p.media.find((m) => !m.video)!;
  const [first, ...rest] = items;
  return (
    <section className="card min-w-0 p-3" aria-label="Top da semana" data-testid="explorar-top">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-semibold">🏆 Top da semana</h2>
        <Link href="/destaques" className="text-xs text-mute underline">como entrar no Top</Link>
      </div>
      {/* mosaico: 1 foto grande + 3 pequenas */}
      <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 md:grid-rows-3">
        <Link href={`/post/${first.post.id}`} className="relative col-span-3 block overflow-hidden rounded-lg md:col-span-3 md:row-span-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${photo(first.post).id}?v=d`} alt="" className="protected-img aspect-[4/3] h-full w-full object-cover md:aspect-auto" draggable={false} />
          <Watermark />
          <span className="absolute left-2 top-2 rounded-full bg-hot px-2 py-0.5 text-[11px] font-bold text-white">#1</span>
          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-xs text-white">@{first.post.author.nick}</span>
        </Link>
        {rest.map(({ post }, i) => (
          <Link key={post.id} href={`/post/${post.id}`} className="relative block overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${photo(post).id}?v=d`} alt="" className="protected-img aspect-square h-full w-full object-cover" draggable={false} />
            <Watermark />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[10px] font-bold text-white">#{i + 2}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "Ao vivo agora": cartões com número de espectadores. */
export async function ExploreLive() {
  const lives = (await liveList()).slice(0, 12);
  return (
    <section className="card min-w-0 p-3" aria-label="Ao vivo" data-testid="explorar-live">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-semibold">🔴 Ao vivo</h2>
        <Link href="/ao-vivo" className="text-xs text-mute underline">{lives.length ? "ver todas" : "fazer uma transmissão"}</Link>
      </div>
      {lives.length === 0 ? (
        <p className="px-1 text-sm text-mute">Ninguém transmitindo agora. <Link href="/ao-vivo" className="text-wine underline">Que tal começar?</Link></p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {lives.map((l) => (
            <Link key={l.id} href={`/ao-vivo/${l.id}`} className="relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-wine to-fuchsia-800 text-white">
              <Avatar mediaId={l.host.avatarId} nick={l.host.nick} size={64} />
              <span className="mt-2 max-w-full truncate px-2 text-sm font-semibold">@{l.host.nick}</span>
              <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 text-[10px] font-bold uppercase">● Live</span>
              <span className="absolute right-2 top-2 rounded bg-black/40 px-1.5 text-[10px]">👁 {l.viewers}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** "Últimas fotos": grade das fotos mais recentes que a pessoa pode ver. */
export async function ExploreLatestPhotos({ user, tipo }: { user: CurrentUser; tipo: ExploreType }) {
  const types = EXPLORE_TYPES[tipo].types as readonly string[] | null;
  const posts = await getFeed(user, { take: 60 });
  const items = posts
    .filter((p) => !types || types.includes(p.author.profileType))
    .flatMap((p) => p.media.filter((m) => !m.video).slice(0, 1).map((m) => ({ post: p, media: m })))
    .slice(0, 18);
  if (!items.length) return null;
  return (
    <section className="card min-w-0 p-3" aria-label="Últimas fotos" data-testid="explorar-fotos">
      <h2 className="mb-2 px-1 font-semibold">📸 Últimas fotos</h2>
      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-6">
        {items.map(({ post, media }) => (
          <Link key={post.id} href={`/post/${post.id}`} className="relative block overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${media.id}?v=d`} alt="" className="protected-img aspect-square w-full object-cover" draggable={false} />
            <Watermark />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white">@{post.author.nick}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
