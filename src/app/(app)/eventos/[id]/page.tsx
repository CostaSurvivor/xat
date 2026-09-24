import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { UF_NAMES } from "@/lib/config";
import { canSeeEvent, fmtEventDate } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { ReportButton } from "@/components/ReportButton";
import { RsvpButtons } from "@/components/RsvpButtons";
import { cancelEvent } from "@/app/actions/events";
import { requireUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const e = await db.event.findUnique({ where: { id: (await params).id }, select: { title: true, status: true } });
  return { title: e?.status === "APPROVED" ? e.title : "Evento" };
}

export default async function Evento({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const e = await db.event.findUnique({ where: { id: (await params).id }, include: { creator: { select: { id: true, nick: true, avatarId: true } } } });
  if (!e || !canSeeEvent(e, user)) notFound();
  const blocked = new Set(await blockedIds(user.id));
  if (blocked.has(e.creatorId) && user.role === "USER") notFound();
  const rsvps = await db.eventRsvp.findMany({ where: { eventId: e.id }, orderBy: { createdAt: "asc" }, take: 300 });
  const users = await db.user.findMany({ where: { id: { in: rsvps.map((r) => r.userId) }, status: "ACTIVE" }, select: { id: true, nick: true, avatarId: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const going = rsvps.filter((r) => r.status === "GOING" && byId.has(r.userId) && !blocked.has(r.userId)).map((r) => byId.get(r.userId)!);
  const maybe = rsvps.filter((r) => r.status === "MAYBE").length;
  const mine = rsvps.find((r) => r.userId === user.id)?.status as "GOING" | "MAYBE" | undefined;
  const styles = await stylesFor([e.creatorId, ...going.slice(0, 40).map((g) => g.id)]);
  const isOwner = e.creatorId === user.id;
  const canManage = isOwner || user.role !== "USER";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/eventos" className="text-sm text-mute hover:text-fg">← Eventos</Link>
      {e.status === "PENDING" && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">⏳ Em análise pela equipe. Só você{user.role !== "USER" ? " e a equipe" : ""} vê este evento por enquanto.</p>}
      {e.status === "REJECTED" && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">Este evento não foi aprovado{e.reviewNote ? `: ${e.reviewNote}` : "."}</p>}
      {e.status === "CANCELED" && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">❌ Evento cancelado.</p>}
      <article className="card overflow-hidden">
        {e.coverMediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${e.coverMediaId}?v=d`} alt="" className="protected-img aspect-[16/9] w-full object-cover" draggable={false} />
        )}
        <div className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-wine">{fmtEventDate(e.startsAt, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}{e.endsAt && ` até ${fmtEventDate(e.endsAt, { hour: "2-digit", minute: "2-digit", ...(e.endsAt.getTime() - e.startsAt.getTime() > 86400_000 ? { day: "2-digit", month: "short" } : {}) })}`}</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">{e.title}</h1>
            <p className="mt-1 text-sm text-mute">📍 {e.venue} · {e.city}, {UF_NAMES[e.state] ?? e.state}{e.priceText && ` · 💳 ${e.priceText}`}</p>
            {e.audience === "COUPLES" && <span className="mt-2 inline-block rounded-full bg-pink-600 px-2 py-0.5 text-xs text-white">💑 Só casais</span>}
          </div>
          {e.status === "APPROVED" && <RsvpButtons eventId={e.id} current={mine ?? null} />}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{e.description}</p>
          <div className="flex items-center gap-2 border-t border-line pt-3 text-sm">
            <Avatar mediaId={e.creator.avatarId} nick={e.creator.nick} size={32} style={styles[e.creatorId]} />
            <span className="text-mute">Divulgado por</span> <Nick nick={e.creator.nick} style={styles[e.creatorId]} />
            <span className="ml-auto flex items-center gap-3">
              {!isOwner && <ReportButton targetType="EVENT" targetId={e.id} />}
              {canManage && e.status !== "CANCELED" && (
                <form action={cancelEvent.bind(null, e.id)}>
                  <button className="text-xs text-red-700 hover:underline">Cancelar evento</button>
                </form>
              )}
            </span>
          </div>
        </div>
      </article>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">🎉 {going.length} {going.length === 1 ? "confirmado" : "confirmados"}{maybe > 0 && <span className="font-normal text-mute"> · {maybe} talvez</span>}</h2>
        {going.length === 0 ? (
          <p className="text-sm text-mute">Ninguém confirmou ainda. Seja o primeiro!</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {going.slice(0, 40).map((g) => (
              <Link key={g.id} href={`/u/${encodeURIComponent(g.nick)}`} className="flex w-16 flex-col items-center gap-1 text-center">
                <Avatar mediaId={g.avatarId} nick={g.nick} size={44} style={styles[g.id]} />
                <span className="w-full truncate text-[11px]">{g.nick}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
