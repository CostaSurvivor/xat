import Link from "next/link";
import { db } from "@/lib/db";
import { PROFILE_TYPES } from "@/lib/config";
import { canSeeGroup } from "@/lib/groups";
import { fmtEventDate } from "@/lib/events";
import { isVerified, requireUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";

export const metadata = { title: "Buscar" };
export const dynamic = "force-dynamic";

/** Busca única: perfis (nick ou cidade), grupos, eventos e salas. */
export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 60);
  const ok = q.length >= 2;
  const blocked = ok ? await blockedIds(user.id) : [];
  const [people, groups, events, rooms] = ok
    ? await Promise.all([
        db.user.findMany({
          where: {
            status: "ACTIVE",
            id: { notIn: [...blocked, user.id] },
            ...(isVerified(user) ? {} : { hideFromUnverified: false }),
            // cidade só conta para quem não esconde a cidade
            OR: [{ nick: { contains: q } }, { city: { contains: q }, hideCity: false }],
          },
          orderBy: { lastSeenAt: "desc" },
          take: 24,
          select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true },
        }),
        db.group.findMany({ where: { OR: [{ name: { contains: q } }, { description: { contains: q } }] }, take: 20 }),
        db.event.findMany({
          where: { status: "APPROVED", startsAt: { gt: new Date(Date.now() - 6 * 3600_000) }, OR: [{ title: { contains: q } }, { city: { contains: q } }, { venue: { contains: q } }] },
          orderBy: { startsAt: "asc" },
          take: 10,
        }),
        db.room.findMany({ where: { isOfficial: true, name: { contains: q } }, take: 10, select: { slug: true, name: true } }),
      ])
    : [[], [], [], []];
  const styles = await stylesFor(people.map((p) => p.id));
  const visibleGroups = groups.filter((g) => canSeeGroup(g, user)).slice(0, 8);
  const total = people.length + visibleGroups.length + events.length + rooms.length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <form className="card flex gap-2 p-3" role="search">
        <input name="q" defaultValue={q} autoFocus placeholder="Buscar perfis, cidades, grupos, eventos e salas" className="input flex-1" aria-label="Buscar" />
        <button className="btn-gold">Buscar</button>
      </form>
      {!ok && <p className="text-center text-sm text-mute">Digite pelo menos 2 letras. Dica: busque um nick, uma cidade ou um tema, como “swing” ou “viagem”.</p>}
      {ok && total === 0 && <p className="card p-8 text-center text-mute">Nada encontrado para “{q}”.</p>}

      {people.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">👥 Perfis ({people.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {people.map((u) => (
              <Link key={u.id} href={`/u/${encodeURIComponent(u.nick)}`} className="flex min-w-0 flex-col items-center rounded-xl p-2 text-center hover:bg-black/5">
                <Avatar mediaId={u.avatarId} nick={u.nick} size={56} style={styles[u.id]} />
                <span className="mt-1 max-w-full truncate text-sm"><Nick nick={u.nick} style={styles[u.id]} link={false} />{u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</span>
                <span className="max-w-full truncate text-xs text-mute">{PROFILE_TYPES[u.profileType].label}{!u.hideCity && u.city ? ` · ${u.city}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {visibleGroups.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">🫂 Grupos</h2>
          <ul className="divide-y divide-line">
            {visibleGroups.map((g) => (
              <li key={g.id}><Link href={`/grupos/${g.slug}`} className="flex items-center gap-2 py-2 hover:text-wine"><span className="text-xl">{g.emoji}</span><span className="font-medium">{g.name}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
      {events.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">🎉 Eventos</h2>
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id}><Link href={`/eventos/${e.id}`} className="block py-2 hover:text-wine"><span className="font-medium">{e.title}</span> <span className="text-xs text-mute">· {fmtEventDate(e.startsAt)} · {e.city}/{e.state}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
      {rooms.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">💬 Salas</h2>
          <div className="flex flex-wrap gap-2">{rooms.map((r) => <Link key={r.slug} href={`/${r.slug}`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-wine">{r.name}</Link>)}</div>
        </section>
      )}
    </div>
  );
}
