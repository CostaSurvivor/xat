import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { isSubscriber, requireUser } from "@/server/auth";
import { getFeed } from "@/server/feed";

export const metadata = { title: "Post" };
export const dynamic = "force-dynamic";

/** Página de um post (mesmas regras de visibilidade e bloqueio do feed). */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [post] = await getFeed(user, { ids: [(await params).id], take: 1 });
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Link href="/destaques" className="text-sm text-mute hover:text-fg">← Destaques</Link>
      <PostCard post={post} viewer={{ nick: user.nick, subscriber: isSubscriber(user) }} />
    </div>
  );
}
