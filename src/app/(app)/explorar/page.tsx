import Link from "next/link";
import { requireUser } from "@/server/auth";
import { EXPLORE_TYPES, ExploreLatestPhotos, ExploreLive, ExploreOnline, ExploreTop, type ExploreType } from "@/components/Explore";
import { FeaturedProfiles, HotContos, SuggestedProfiles, VideoStrip } from "@/components/FeedSections";

export const metadata = { title: "Explorar" };
export const dynamic = "force-dynamic";

/** Explorar: tudo o que está acontecendo, numa tela só. */
export default async function Explorar({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await requireUser();
  const raw = (await searchParams).tipo ?? "";
  const tipo: ExploreType = raw in EXPLORE_TYPES ? (raw as ExploreType) : "";
  return (
    // vitrine larga (até 1360px), com grades de 6 colunas no computador
    <div className="mx-auto w-full min-w-0 max-w-[1360px] space-y-2">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🧭 Explorar</h1>
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Filtrar por tipo de perfil" data-testid="explorar-filtro">
        {(Object.keys(EXPLORE_TYPES) as ExploreType[]).map((k) => (
          <Link key={k || "todos"} href={k ? `/explorar?tipo=${k}` : "/explorar"} aria-current={tipo === k ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${tipo === k ? "border-wine2 bg-wine2 text-white" : "border-line bg-panel text-mute hover:border-wine2"}`}>
            {EXPLORE_TYPES[k].label}
          </Link>
        ))}
      </nav>
      <ExploreOnline user={user} tipo={tipo} />
      <ExploreTop user={user} />
      <SuggestedProfiles user={user} />
      <ExploreLive />
      <ExploreLatestPhotos user={user} tipo={tipo} />
      <VideoStrip user={user} />
      <FeaturedProfiles user={user} />
      <HotContos user={user} />
    </div>
  );
}
