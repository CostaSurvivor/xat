import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { UFS, UF_NAMES } from "@/lib/config";
import { canCreateEvent } from "@/lib/events";
import { EventCard } from "@/components/EventCard";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Eventos" };
export const dynamic = "force-dynamic";

const withGoing = { _count: { select: { rsvps: { where: { status: "GOING" } } } } } as const;

export default async function Eventos({ searchParams }: { searchParams: Promise<{ uf?: string }> }) {
  const user = await requireUser();
  const { uf = "" } = await searchParams;
  // começam a sumir 12 h depois do início (ou no fim, se informado)
  const cutoff = new Date(Date.now() - 12 * 3600_000);
  const where: Prisma.EventWhereInput = { status: "APPROVED", OR: [{ endsAt: { gte: new Date() } }, { endsAt: null, startsAt: { gte: cutoff } }] };
  if (uf) where.state = uf;
  const [events, mine] = await Promise.all([
    db.event.findMany({ where, orderBy: { startsAt: "asc" }, take: 120, include: withGoing }),
    db.event.findMany({ where: { creatorId: user.id, status: { in: ["PENDING", "REJECTED"] } }, orderBy: { createdAt: "desc" }, take: 10, include: withGoing }),
  ]);
  // sem filtro: eventos do meu estado primeiro, mantendo a ordem por data
  const list = uf ? events : [...events.filter((e) => e.state === user.state), ...events.filter((e) => e.state !== user.state)];
  const denied = canCreateEvent(user);
  const card = (e: (typeof events)[number]) => ({ ...e, going: e._count.rsvps });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">🎉 Eventos</h1>
        {denied ? (
          <Link href={denied.includes("assinantes") ? "/assinar" : "/verificacao"} className="btn-ghost" title={denied}>⭐ Assine e divulgue seu evento</Link>
        ) : (
          <Link href="/eventos/novo" className="btn-gold">+ Divulgar evento</Link>
        )}
      </div>
      <p className="text-sm text-mute">Festas, encontros e noites temáticas do meio liberal. Todo evento passa pela aprovação da equipe antes de aparecer.</p>
      <form className="flex gap-2">
        <select name="uf" defaultValue={uf} className="input w-auto">
          <option value="">Todo o Brasil{user.state ? ` (${user.state} primeiro)` : ""}</option>
          {UFS.map((u) => <option key={u} value={u}>{UF_NAMES[u]}</option>)}
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-wine">Seus eventos em análise</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((e) => <EventCard key={e.id} e={card(e)} />)}</div>
        </section>
      )}
      {list.length === 0 ? (
        <div className="card p-8 text-center text-mute">
          <p className="text-4xl">🗓️</p>
          <p className="mt-2">Nenhum evento {uf ? `em ${UF_NAMES[uf]}` : "por enquanto"}.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((e) => <EventCard key={e.id} e={card(e)} />)}</div>
      )}
    </div>
  );
}
