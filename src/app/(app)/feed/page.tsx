import Link from "next/link";
import { requireUser, isVerified } from "@/server/auth";
import { getFeed, type FeedTab } from "@/server/feed";
import { Composer } from "@/components/Composer";
import { PostCard } from "@/components/PostCard";
import { OnlineRooms } from "@/components/OnlineRooms";

export const metadata = { title: "Feed" };

export default async function Feed({ searchParams }: { searchParams: Promise<{ tab?: FeedTab; antes?: string }> }) {
  const user = await requireUser();
  const { tab = "todos", antes } = await searchParams;
  const posts = await getFeed(user, { tab, before: antes });
  const tabs: [FeedTab, string][] = [["todos", "Todos"], ["seguindo", "Seguindo"], ["regiao", `Minha região${user.state ? ` (${user.state})` : ""}`]];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Composer verified={isVerified(user)} />
        <div className="flex gap-2">
          {tabs.map(([k, l]) => (
            <Link key={k} href={`/feed?tab=${k}`} className={`rounded-full px-3 py-1 text-sm ${tab === k ? "bg-wine text-white" : "text-mute hover:text-white"}`}>{l}</Link>
          ))}
        </div>
        {posts.length === 0 && <p className="card p-8 text-center text-mute">Nada por aqui ainda. Que tal postar algo? 🔥</p>}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
        {posts.length === 15 && (
          <Link href={`/feed?tab=${tab}&antes=${encodeURIComponent(posts[posts.length - 1].createdAt)}`} className="btn-ghost w-full">Carregar mais</Link>
        )}
      </div>
      <aside className="hidden lg:block"><OnlineRooms /></aside>
    </div>
  );
}
