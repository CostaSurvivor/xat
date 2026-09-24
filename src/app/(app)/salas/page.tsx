import Link from "next/link";
import { db } from "@/lib/db";
import { COUPLES_ROOM, GENERAL_ROOM, REGIONS, isCouple, regionOf } from "@/lib/config";
import { requireUser } from "@/server/auth";
import { roomOnlineCounts } from "@/server/rooms";

export const metadata = { title: "Salas" };
export const dynamic = "force-dynamic";

/** Salas da plataforma: Geral, Só Casais e uma por estado (ninguém cria salas). */
export default async function Salas() {
  const user = await requireUser();
  const [rooms, counts] = await Promise.all([db.room.findMany({ where: { isOfficial: true }, take: 100 }), roomOnlineCounts()]);
  const on = (id: string) => counts.get(id) ?? 0;
  const general = rooms.find((r) => r.slug === GENERAL_ROOM.slug);
  const couples = rooms.find((r) => r.slug === COUPLES_ROOM.slug);
  // estado de quem está vendo primeiro, depois quem tem mais gente online, depois A-Z
  const states = rooms
    .filter((r) => r !== general && r !== couples)
    .sort((a, b) => Number(b.state === user.state) - Number(a.state === user.state) || on(b.id) - on(a.id) || a.name.localeCompare(b.name, "pt-BR"));
  // salas agrupadas por região: a região de quem está vendo primeiro, depois a mais movimentada
  const mine = regionOf(user.state)?.key;
  const regions = REGIONS.map((region, order) => {
    const list = states.filter((r) => (region.ufs as readonly string[]).includes(r.state ?? ""));
    return { region, order, rooms: list, online: list.reduce((n, r) => n + on(r.id), 0) };
  })
    .filter((g) => g.rooms.length)
    .sort((a, b) => Number(b.region.key === mine) - Number(a.region.key === mine) || b.online - a.online || a.order - b.order);
  const Pill = ({ id }: { id: string }) => (
    <span className={`shrink-0 rounded-full px-3 py-1 text-sm ${on(id) ? "bg-green-100 text-green-700" : "bg-panel2 text-mute"}`}>{on(id)} on</span>
  );

  return (
    <div className="space-y-5">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Salas</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {general && (
          <Link href={`/${general.slug}`} className="card flex min-w-0 items-center gap-4 border-wine/30 p-5 transition hover:border-wine">
            <span className="text-4xl">🇧🇷</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Geral <span className="text-sm font-normal text-mute">· todo o Brasil</span></h2>
              <p className="truncate text-sm text-mute">{general.description}</p>
            </div>
            <Pill id={general.id} />
          </Link>
        )}
        {couples && (
          <Link href={`/${couples.slug}`} className="card flex min-w-0 items-center gap-4 border-pink-300 p-5 transition hover:border-pink-500">
            <span className="text-4xl">💑</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Só Casais</h2>
              <p className="truncate text-sm text-mute">{isCouple(user.profileType) ? "Exclusiva para perfis de casal." : "🔒 Só perfis de casal entram."}</p>
            </div>
            <Pill id={couples.id} />
          </Link>
        )}
      </div>
      {regions.map(({ region, rooms: list, online }) => (
        <section key={region.key} className={region.key === "SUL" ? "rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-red-50 p-3" : ""}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-wine">{region.emoji} {region.name}</h2>
            <span className="text-xs text-mute">{region.tagline}</span>
            {online > 0 && <span className="text-xs text-green-600">· {online} on</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((r) => (
              <Link key={r.id} href={`/${r.slug}`} className={`card flex items-center gap-2 px-3 py-2.5 transition hover:border-wine/50 ${r.state === user.state ? "border-wine/40" : ""}`}>
                <span className="w-8 shrink-0 rounded bg-panel2 py-0.5 text-center text-xs font-bold text-wine">{r.state ?? r.slug.toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                <span className={`shrink-0 text-xs ${on(r.id) ? "text-green-600" : "text-mute"}`}>{on(r.id)}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
