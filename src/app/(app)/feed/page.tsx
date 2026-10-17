import Link from "next/link";
import { normalizeTag } from "@/lib/richtext";
import { requireUser, isVerified, isSubscriber } from "@/server/auth";
import { getFeed, type FeedTab } from "@/server/feed";
import { Composer } from "@/components/Composer";
import { PostCard } from "@/components/PostCard";
import { OnlineRooms } from "@/components/OnlineRooms";
import { HotPhotos } from "@/components/HotPhotos";
import { liveList } from "@/server/live";
import { StoryTray } from "@/components/StoryTray";
import { OnboardingCard } from "@/components/OnboardingCard";
import { DailyCard } from "@/components/DailyCard";
import { FeaturedProfiles, HotContos, OnlineNow, SuggestedProfiles, VideoStrip } from "@/components/FeedSections";

export const metadata = { title: "Feed" };

export default async function Feed({ searchParams }: { searchParams: Promise<{ tab?: FeedTab; antes?: string; tag?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: FeedTab = (["todos", "seguindo", "amigos", "regiao"] as const).includes(sp.tab as FeedTab) ? (sp.tab as FeedTab) : "todos";
  const antes = sp.antes;
  const tag = typeof sp.tag === "string" ? normalizeTag(sp.tag) : null;
  const [posts, lives] = await Promise.all([getFeed(user, { tab, before: antes, tag }), liveList()]);
  const tabs: [FeedTab, string][] = [["todos", "Todos"], ["seguindo", "Seguindo"], ["amigos", "Amigos e favoritos"], ["regiao", `Minha região${user.state ? ` (${user.state})` : ""}`]];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="mx-auto w-full min-w-0 max-w-xl space-y-4">
        {lives.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {lives.slice(0, 10).map((l) => (
              <Link key={l.id} href={`/ao-vivo/${l.id}`} className="shrink-0 rounded-full border border-red-500/60 bg-red-100 px-3 py-1 text-xs">
                <span className="live-dot text-red-600">●</span> @{l.host.nick} <span className="text-mute">👁 {l.viewers}</span>
              </Link>
            ))}
          </div>
        )}
        <OnboardingCard user={user} />
        <DailyCard user={user} />
        <StoryTray viewer={user} />
        <OnlineNow user={user} />
        <FeaturedProfiles user={user} />
        <SuggestedProfiles user={user} />
        <div className="lg:hidden"><HotPhotos user={user} /></div>
        <VideoStrip user={user} />
        <HotContos user={user} />
        <Composer verified={isVerified(user)} />
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, l]) => (
            <Link key={k} href={`/feed?tab=${k}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`} className={`rounded-full px-3 py-1 text-sm ${tab === k ? "bg-wine text-white" : "text-mute hover:text-fg"}`}>{l}</Link>
          ))}
        </div>
        {tag && (
          <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm" data-testid="filtro-tag">
            <span>Posts com <b className="text-wine">#{tag}</b></span>
            <Link href={`/feed?tab=${tab}`} className="ml-auto text-xs text-mute underline">limpar ✕</Link>
          </div>
        )}
        {posts.length === 0 && <p className="card p-8 text-center text-mute">Nada por aqui ainda. Que tal postar algo? 🔥</p>}
        {posts.map((p) => <PostCard key={p.id} post={p} viewer={{ nick: user.nick, subscriber: isSubscriber(user) }} />)}
        {posts.length === 15 && (
          <Link href={`/feed?tab=${tab}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}&antes=${encodeURIComponent(posts[posts.length - 1].createdAt)}`} className="btn-ghost w-full">Carregar mais</Link>
        )}
      </div>
      <aside className="hidden space-y-4 lg:block"><HotPhotos user={user} /><OnlineRooms /></aside>
    </div>
  );
}
