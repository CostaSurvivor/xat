import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canSeeGroup } from "@/lib/groups";
import { Composer } from "@/components/Composer";
import { GroupJoinButton } from "@/components/GroupJoinButton";
import { PostCard } from "@/components/PostCard";
import { isSubscriber, isVerified, requireUser } from "@/server/auth";
import { getFeed } from "@/server/feed";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = await db.group.findUnique({ where: { slug: (await params).slug }, select: { name: true } });
  return { title: g?.name ?? "Grupo" };
}

export default async function Grupo({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ antes?: string }> }) {
  const user = await requireUser();
  const g = await db.group.findUnique({ where: { slug: (await params).slug }, include: { _count: { select: { members: true } } } });
  if (!g || !canSeeGroup(g, user)) notFound();
  const { antes } = await searchParams;
  const [member, posts] = await Promise.all([
    db.groupMember.findUnique({ where: { groupId_userId: { groupId: g.id, userId: user.id } } }),
    getFeed(user, { groupId: g.id, before: antes, take: 15 }),
  ]);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/grupos" className="text-sm text-mute hover:text-fg">← Grupos</Link>
      {g.archivedAt && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">Grupo arquivado (visível só para a equipe).</p>}
      <div className="card flex flex-wrap items-start gap-3 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-3xl">{g.emoji}</span>
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{g.name}</h1>
          <p className="text-xs text-mute">{g._count.members} {g._count.members === 1 ? "membro" : "membros"}{g.audience === "COUPLES" && " · 💑 só casais"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{g.description}</p>
        </div>
        {!g.archivedAt && <GroupJoinButton groupId={g.id} member={!!member} />}
      </div>
      {member && !g.archivedAt ? (
        <Composer verified={isVerified(user)} groupId={g.id} placeholder={`Escreva no grupo ${g.name}…`} />
      ) : (
        !g.archivedAt && <p className="card p-4 text-center text-sm text-mute">Participe do grupo para postar e comentar.</p>
      )}
      {posts.length === 0 && <p className="card p-8 text-center text-mute">Nenhum post ainda. Comece a conversa! 💬</p>}
      {posts.map((p) => <PostCard key={p.id} post={p} viewer={{ nick: user.nick, subscriber: isSubscriber(user) }} />)}
      {posts.length === 15 && <Link href={`/grupos/${g.slug}?antes=${encodeURIComponent(posts[posts.length - 1].createdAt)}`} className="btn-ghost w-full">Carregar mais</Link>}
    </div>
  );
}
