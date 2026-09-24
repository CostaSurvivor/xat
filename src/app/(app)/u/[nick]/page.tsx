import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES } from "@/lib/config";
import { isVerified, requireUser } from "@/server/auth";
import { isBlockedBetween } from "@/server/access";
import { getFeed } from "@/server/feed";
import { stylesFor } from "@/server/styles";
import { requestAlbum, toggleBlock, toggleFollow } from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { PostCard } from "@/components/PostCard";
import { ProtectedImage } from "@/components/ProtectedImage";
import { ReportButton } from "@/components/ReportButton";
import { GiftButton } from "@/components/GiftButton";

export async function generateMetadata({ params }: { params: Promise<{ nick: string }> }) {
  return { title: `@${decodeURIComponent((await params).nick)}` };
}

export default async function UserPage({ params }: { params: Promise<{ nick: string }> }) {
  const viewer = await requireUser();
  const nick = decodeURIComponent((await params).nick);
  const u = await db.user.findFirst({ where: { nick }, include: { persons: true } });
  if (!u || u.status === "DELETED" || u.status === "BANNED") notFound();
  const me = u.id === viewer.id;
  const iBlocked = await db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: u.id } } });
  if (!me && !iBlocked && (await isBlockedBetween(viewer.id, u.id))) notFound();

  const [followers, following, isFollowing, album, access, posts, styles] = await Promise.all([
    db.follow.count({ where: { followeeId: u.id } }),
    db.follow.count({ where: { followerId: u.id } }),
    db.follow.findUnique({ where: { followerId_followeeId: { followerId: viewer.id, followeeId: u.id } } }),
    db.media.findMany({ where: { ownerId: u.id, kind: "PRIVATE_ALBUM", status: "APPROVED" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    db.albumAccess.findUnique({ where: { ownerId_viewerId: { ownerId: u.id, viewerId: viewer.id } } }),
    iBlocked ? Promise.resolve([]) : getFeed(viewer, { authorId: u.id, take: 30 }),
    stylesFor([u.id]),
  ]);
  const st = styles[u.id];
  const likes = (u.likes as string[] | null) ?? [];
  const canSeeAlbum = me || access?.granted;
  const hidden = u.hideFromUnverified && !isVerified(viewer) && !me;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card p-5">
        <div className="flex items-start gap-4">
          <Avatar mediaId={hidden ? null : u.avatarId} nick={u.nick} size={88} style={st} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl"><Nick nick={u.nick} style={st} link={false} /> {u.ageVerification === "APPROVED" && <span title="Perfil verificado" className="text-sm text-gold">✔ verificado</span>}</h1>
            <p className="text-sm text-mute">
              {PROFILE_TYPES[u.profileType].label} · {u.persons.map((p) => `${p.label} ${ageOn(p.birthDate)}`).join(", ")}
              {!u.hideCity && u.city ? ` · ${u.city}/${u.state}` : u.state ? ` · ${u.state}` : ""}
            </p>
            <p className="mt-1 text-xs text-mute"><b className="text-white">{followers}</b> seguidores · <b className="text-white">{following}</b> seguindo</p>
            {!me && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!iBlocked && <form action={toggleFollow.bind(null, u.id)}><button className={isFollowing ? "btn-ghost" : "btn-gold"}>{isFollowing ? "Seguindo ✓" : "Seguir"}</button></form>}
                {!iBlocked && <Link href={`/mensagens/${u.nick}`} className="btn-wine">✉️ PV</Link>}
                {!iBlocked && <GiftButton toId={u.id} toNick={u.nick} />}
                <form action={toggleBlock.bind(null, u.id)}><button className="btn-ghost text-xs">{iBlocked ? "Desbloquear" : "Bloquear"}</button></form>
                <ReportButton targetType="USER" targetId={u.id} />
              </div>
            )}
            {me && <Link href="/perfil" className="btn-ghost mt-3">Editar perfil</Link>}
          </div>
        </div>
        {u.bio && !hidden && <p className="mt-4 whitespace-pre-wrap text-sm">{u.bio}</p>}
        {likes.length > 0 && !hidden && (
          <div className="mt-3 flex flex-wrap gap-1.5">{likes.map((t) => <span key={t} className="rounded-full border border-wine2/60 bg-wine/20 px-2.5 py-0.5 text-xs">{t}</span>)}</div>
        )}
        {hidden && <p className="mt-4 text-sm text-mute">Este perfil só é visível para perfis verificados. <Link href="/verificacao" className="text-gold underline">Verificar agora</Link></p>}
      </section>

      {!iBlocked && !hidden && album.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-gold">🔒 Álbum privado ({album.length})</h2>
            {!canSeeAlbum && (access ? <span className="text-xs text-mute">Pedido enviado</span> : <form action={requestAlbum.bind(null, u.id)}><button className="btn-wine text-xs">Pedir acesso</button></form>)}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {album.slice(0, canSeeAlbum ? 30 : 6).map((m) => <ProtectedImage key={m.id} id={m.id} className="aspect-square rounded-lg" />)}
          </div>
        </section>
      )}

      {!hidden && posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
