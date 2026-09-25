import Link from "next/link";
import { fmtEventDate } from "@/lib/events";

type R = Awaited<ReturnType<typeof import("@/server/search").searchOthers>>;

/** Resultados que não são pessoas (grupos, eventos, contos e salas), na busca de Pessoas. */
export function SearchOthers({ q, r }: { q: string; r: R }) {
  if (!r.groups.length && !r.events.length && !r.rooms.length && !r.contos.length) return null;
  return (
    <section className="space-y-3" aria-label="Outros resultados" data-testid="outros">
      <h2 className="font-semibold">🔎 Também encontrado para “{q}”</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {r.groups.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">🫂 Grupos</h3>
            <ul className="divide-y divide-line text-sm">{r.groups.map((g) => <li key={g.id}><Link href={`/grupos/${g.slug}`} className="flex items-center gap-2 py-1.5 hover:text-wine"><span>{g.emoji}</span>{g.name}</Link></li>)}</ul>
          </div>
        )}
        {r.events.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">🎉 Eventos</h3>
            <ul className="divide-y divide-line text-sm">{r.events.map((e) => <li key={e.id}><Link href={`/eventos/${e.id}`} className="block py-1.5 hover:text-wine">{e.title} <span className="text-xs text-mute">· {fmtEventDate(e.startsAt)} · {e.city}/{e.state}</span></Link></li>)}</ul>
          </div>
        )}
        {r.contos.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">📖 Contos</h3>
            <ul className="divide-y divide-line text-sm">{r.contos.map((c) => <li key={c.id}><Link href={`/contos/${c.id}`} className="flex gap-2 py-1.5 hover:text-wine"><span className="min-w-0 truncate">{c.title}</span><span className="ml-auto shrink-0 text-xs text-mute">@{c.author.nick} · ❤ {c.likeCount}</span></Link></li>)}</ul>
          </div>
        )}
        {r.rooms.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">💬 Salas</h3>
            <div className="flex flex-wrap gap-2">{r.rooms.map((x) => <Link key={x.slug} href={`/${x.slug}`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-wine">{x.name}</Link>)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
