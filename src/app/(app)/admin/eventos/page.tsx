import Link from "next/link";
import { db } from "@/lib/db";
import { fmtEventDate } from "@/lib/events";
import { reviewEvent } from "@/app/actions/events";
import { requireStaff } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminEventos() {
  await requireStaff();
  const [pending, upcoming] = await Promise.all([
    db.event.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { creator: { select: { nick: true } } } }),
    db.event.findMany({ where: { status: "APPROVED", startsAt: { gte: new Date(Date.now() - 12 * 3600_000) } }, orderBy: { startsAt: "asc" }, take: 50, include: { creator: { select: { nick: true } }, _count: { select: { rsvps: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-bold">Eventos para aprovar ({pending.length})</h1>
        {pending.length === 0 && <p className="text-sm text-mute">Nada na fila. 🎉</p>}
        {pending.map((e) => (
          <div key={e.id} className="card space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-baseline gap-2">
              <Link href={`/eventos/${e.id}`} className="font-semibold hover:underline">{e.title}</Link>
              <span className="text-xs text-mute">por @{e.creator.nick} · {fmtEventDate(e.startsAt)} · {e.venue}, {e.city}/{e.state}{e.audience === "COUPLES" && " · só casais"}</span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-mute">{e.description}</p>
            <div className="flex flex-wrap gap-2">
              <form action={reviewEvent.bind(null, e.id)}><input type="hidden" name="op" value="approve" /><button className="btn-gold py-1 text-xs">Aprovar</button></form>
              <form action={reviewEvent.bind(null, e.id)} className="flex gap-1">
                <input type="hidden" name="op" value="reject" />
                <input name="note" required maxLength={200} placeholder="Motivo da recusa (vai para quem criou)" className="input w-72 py-1 text-xs" />
                <button className="btn-wine py-1 text-xs">Recusar</button>
              </form>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Próximos eventos aprovados</h2>
        <div className="card divide-y divide-line">
          {upcoming.length === 0 && <p className="p-3 text-sm text-mute">Nenhum.</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Link href={`/eventos/${e.id}`} className="font-semibold hover:underline">{e.title}</Link>
              <span className="text-xs text-mute">{fmtEventDate(e.startsAt)} · {e.city}/{e.state} · @{e.creator.nick} · {e._count.rsvps} respostas</span>
              <form action={reviewEvent.bind(null, e.id)} className="ml-auto flex gap-1">
                <input type="hidden" name="op" value="cancel" />
                <input name="note" maxLength={200} placeholder="Motivo" className="input w-40 py-1 text-xs" />
                <button className="btn-ghost py-1 text-xs">Tirar do ar</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
