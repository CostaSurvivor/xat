import Link from "next/link";
import { isSubscriber, requireUser } from "@/server/auth";
import { getFeed } from "@/server/feed";
import { VideoThumb } from "@/components/FeedSections";

export const metadata = { title: "Vídeos" };
export const dynamic = "force-dynamic";

export default async function Videos({ searchParams }: { searchParams: Promise<{ antes?: string }> }) {
  const user = await requireUser();
  const { antes } = await searchParams;
  const posts = await getFeed(user, { videosOnly: true, take: 24, before: antes });
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">🎬 Vídeos</h1>
        {!isSubscriber(user) && <Link href="/assinar" className="btn-gold py-1.5 text-sm">⭐ Assine para assistir</Link>}
      </div>
      {posts.length === 0 ? (
        <p className="card p-8 text-center text-mute">Nenhum vídeo ainda. Perfis verificados podem postar vídeos pelo feed. 🎬</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {posts.map((p) => <VideoThumb key={p.id} post={p} />)}
        </div>
      )}
      {posts.length === 24 && <Link href={`/videos?antes=${encodeURIComponent(posts[posts.length - 1].createdAt)}`} className="btn-ghost w-full">Carregar mais</Link>}
    </div>
  );
}
