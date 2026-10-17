import Link from "next/link";
import { normalizeTag } from "@/lib/richtext";
import { requireUser, isVerified, isSubscriber } from "@/server/auth";
import { getFeed, type FeedTab } from "@/server/feed";
import { Composer } from "@/components/Composer";
import { PostCard } from "@/components/PostCard";
import { liveList } from "@/server/live";
import { StoryTray } from "@/components/StoryTray";
import { OnboardingCard } from "@/components/OnboardingCard";
import { DailyCard } from "@/components/DailyCard";

export const metadata = { title: "Novidades" };

export default async function Feed({ searchParams }: { searchParams: Promise<{ tab?: FeedTab; antes?: string; tag?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: FeedTab = (["todos", "seguindo", "amigos", "regiao"] as const).includes(sp.tab as FeedTab) ? (sp.tab as FeedTab) : "todos";
  const antes = sp.antes;
  const tag = typeof sp.tag === "string" ? normalizeTag(sp.tag) : null;
  const [posts, lives] = await Promise.all([getFeed(user, { tab, before: antes, tag }), liveList()]);
  const tabs: [FeedTab, string][] = [["todos", "Todos"], ["seguindo", "Seguindo"], ["amigos", "Amigos e favoritos"], ["regiao", `Minha região${user.state ? ` (${user.state})` : ""}`]];
  return (
    // Novidades: uma coluna estreita (680px), como uma rede social; vitrines ficam no Explorar
    <div className="mx-auto w-full min-w-0 max-w-[680px] space-y-2">
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
        <Composer verified={isVerified(user)} />
        <div className="card overflow-hidden">
          <h1 className="px-4 pt-3 text-lg font-bold">Novidades</h1>
          <nav className="flex gap-1 overflow-x-auto px-2 [scrollbar-width:none]" aria-label="Abas do feed" data-testid="abas-feed">
            {tabs.map(([k, l]) => (
              <Link key={k} href={`/feed?tab=${k}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`} aria-current={tab === k ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === k ? "border-wine2 text-wine2" : "border-transparent text-mute hover:text-fg"}`}>{l}</Link>
            ))}
          </nav>
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
  );
}
