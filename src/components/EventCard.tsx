import Link from "next/link";
import { fmtEventDate } from "@/lib/events";

export type EventCardData = {
  id: string; title: string; startsAt: Date; city: string; state: string; venue: string;
  audience: string; coverMediaId: string | null; status: string; going: number;
};

const STATUS: Record<string, string> = { PENDING: "⏳ em análise", REJECTED: "recusado", CANCELED: "cancelado" };

export function EventCard({ e }: { e: EventCardData }) {
  return (
    <Link href={`/eventos/${e.id}`} className="card group flex min-w-0 flex-col overflow-hidden transition hover:border-wine/50">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-pink-100 via-panel2 to-wine/20">
        {e.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${e.coverMediaId}?v=d`} alt="" className="protected-img h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-5xl">🎉</span>
        )}
        <span className="absolute left-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-center text-xs font-bold leading-tight text-wine shadow">
          {fmtEventDate(e.startsAt, { day: "2-digit" })}
          <br />
          <span className="font-semibold uppercase">{fmtEventDate(e.startsAt, { month: "short" }).replace(".", "")}</span>
        </span>
        {e.audience === "COUPLES" && <span className="absolute right-2 top-2 rounded-full bg-pink-600 px-2 py-0.5 text-xs text-white">💑 só casais</span>}
        {STATUS[e.status] && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{STATUS[e.status]}</span>}
      </div>
      <div className="min-w-0 p-3">
        <h3 className="truncate font-semibold group-hover:text-wine">{e.title}</h3>
        <p className="truncate text-xs text-mute">{fmtEventDate(e.startsAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {e.venue}</p>
        <p className="truncate text-xs text-mute">📍 {e.city}/{e.state}{e.going > 0 && ` · ${e.going} ${e.going === 1 ? "vai" : "vão"}`}</p>
      </div>
    </Link>
  );
}
