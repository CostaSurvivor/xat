import Link from "next/link";
import { db } from "@/lib/db";
import { isVerified, type CurrentUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { getFeed } from "@/server/feed";
import { stylesFor } from "@/server/styles";
import { hotContos } from "@/server/contos";
import { CONTO_CATEGORIES, isCategory } from "@/lib/contos";
import { Avatar } from "./Avatar";

/** Faixa "🟢 Online agora": quem entrou nos últimos 5 min (sem bloqueados e sem quem usa o poder Invisível). */
export async function OnlineNow({ user }: { user: CurrentUser }) {
  const blocked = await blockedIds(user.id);
  const rows = await db.user.findMany({
    where: {
      status: "ACTIVE",
      id: { notIn: [...blocked, user.id] },
      lastSeenAt: { gt: new Date(Date.now() - 5 * 60_000) },
      ...(isVerified(user) ? {} : { hideFromUnverified: false }),
    },
    orderBy: { lastSeenAt: "desc" },
    take: 30,
    select: { id: true, nick: true, avatarId: true },
  });
  const styles = await stylesFor(rows.map((r) => r.id));
  const list = rows.filter((r) => !styles[r.id]?.powers.includes("INVISIBLE")).slice(0, 16);
  if (!list.length) return null;
  return (
    <section className="card p-3" aria-label="Online agora">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">🟢 Online agora</h2>
        <Link href="/pessoas?on=1&raio=br" className="text-xs text-mute underline">ver todos</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {list.map((u) => (
          <Link key={u.id} href={`/u/${encodeURIComponent(u.nick)}`} className="flex w-14 shrink-0 flex-col items-center gap-1">
            <span className="relative">
              <Avatar mediaId={u.avatarId} nick={u.nick} size={48} style={styles[u.id]} />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-green-500" />
            </span>
            <span className="w-full truncate text-center text-[11px] text-mute">{u.nick}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Faixa "🎬 Vídeos": vídeos recentes que a pessoa pode ver (capa; tocar é para assinantes). */
export async function VideoStrip({ user }: { user: CurrentUser }) {
  const posts = await getFeed(user, { videosOnly: true, take: 8 });
  if (!posts.length) return null;
  return (
    <section className="card p-3" aria-label="Vídeos">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">🎬 Vídeos</h2>
        <Link href="/videos" className="text-xs text-mute underline">ver todos</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {posts.map((p) => <VideoThumb key={p.id} post={p} className="w-28 shrink-0" />)}
      </div>
    </section>
  );
}

export function VideoThumb({ post, className = "" }: { post: { id: string; author: { nick: string }; media: { id: string; video: boolean }[] }; className?: string }) {
  const v = post.media.find((m) => m.video);
  if (!v) return null;
  return (
    <Link href={`/post/${post.id}`} className={`group relative block overflow-hidden rounded-lg bg-black ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/media/${v.id}?v=d`} alt="" draggable={false} className="protected-img aspect-[3/4] w-full object-cover opacity-90 transition group-hover:opacity-100" />
      <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">{"\u25B6\uFE0E"}</span></span>
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[11px] text-white">@{post.author.nick}</span>
    </Link>
  );
}

/** Seção "🏆 Destaques da semana": os 3 perfis mais curtidos de cada grupo (casais, mulheres, homens, trans e outros). */
export async function FeaturedProfiles({ user }: { user: CurrentUser }) {
  const { topProfiles } = await import("@/server/ranking");
  const { PROFILE_GROUPS } = await import("@/lib/ranking");
  const groups = Object.keys(PROFILE_GROUPS) as (keyof typeof PROFILE_GROUPS)[];
  const lists = await Promise.all(groups.map((g) => topProfiles(user, 7, g, 3)));
  const items = groups.flatMap((g, gi) => lists[gi].map((u, i) => ({ ...u, rank: i + 1, group: PROFILE_GROUPS[g].label })));
  if (!items.length) return null;
  return (
    <section className="card p-3" aria-label="Destaques da semana">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">🏆 Destaques da semana</h2>
        <Link href="/destaques?aba=perfis" className="text-xs text-mute underline">ver ranking</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((u) => (
          <Link key={u.id} href={`/u/${encodeURIComponent(u.nick)}`} className="flex w-16 shrink-0 flex-col items-center gap-1" title={`${u.rank}º em ${u.group}`}>
            <span className="relative">
              <Avatar mediaId={u.avatarId} nick={u.nick} size={52} style={u.style} />
              <span className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${u.rank === 1 ? "bg-amber-500" : "bg-wine2"}`}>{u.rank}</span>
            </span>
            <span className="w-full truncate text-center text-[11px]">{u.nick}</span>
            <span className="w-full truncate text-center text-[10px] text-mute">{u.group}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Faixa "📖 Contos em alta": os mais curtidos do mês. */
export async function HotContos({ user }: { user: CurrentUser }) {
  const contos = await hotContos(user, 6);
  if (!contos.length) return null;
  return (
    <section className="card p-3" aria-label="Contos em alta">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">📖 Contos em alta</h2>
        <Link href="/contos" className="text-xs text-mute underline">ver todos</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {contos.map((c) => {
          const cat = isCategory(c.category) ? CONTO_CATEGORIES[c.category] : null;
          return (
            <Link key={c.id} href={`/contos/${c.id}`} className="flex w-48 shrink-0 flex-col rounded-xl border border-line p-3 hover:border-wine">
              <span className="text-xs text-mute">{cat ? `${cat.emoji} ${cat.label}` : "Conto"}</span>
              <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{c.title}</span>
              <span className="mt-auto pt-2 text-xs text-mute">@{c.author.nick} · ❤ {c.likeCount}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
