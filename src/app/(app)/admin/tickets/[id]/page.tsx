import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/server/auth";
import { approveNickChange, approveProfileType } from "@/app/actions/tickets";
import { PROFILE_TYPES } from "@/lib/config";
import { TicketThread } from "@/components/TicketThread";

export const dynamic = "force-dynamic";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const t = await db.ticket.findUnique({ where: { id: (await params).id }, include: { user: { select: { nick: true } } } });
  if (!t) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="mr-auto text-sm text-mute">← tickets</Link>
        <Link href={`/u/${t.user.nick}`} className="btn-ghost py-1 text-xs">Ver perfil</Link>
      </div>
      {t.category === "NICK_CHANGE" && t.status !== "CLOSED" && t.requestedNick && (
        <form action={approveNickChange.bind(null, t.id)} className="card flex items-center gap-3 border-gold/50 p-4 text-sm">
          <span className="flex-1">Trocar <b>@{t.user.nick}</b> para <b className="text-gold2">@{t.requestedNick}</b>?</span>
          <button className="btn-gold">✅ Aprovar troca</button>
        </form>
      )}
      {t.category === "PROFILE_TYPE" && t.status !== "CLOSED" && t.requestedData && (() => {
        const d = t.requestedData as { type: string; births: string[] };
        return (
          <form action={approveProfileType.bind(null, t.id)} className="card flex flex-wrap items-center gap-3 border-gold/50 p-4 text-sm">
            <span className="flex-1">
              Mudar <b>@{t.user.nick}</b> para <b className="text-gold2">{PROFILE_TYPES[d.type as keyof typeof PROFILE_TYPES]?.label}</b> · nascimentos:{" "}
              {d.births.map((b) => b.split("-").reverse().join("/")).join(" e ")}
            </span>
            <button className="btn-gold">✅ Aprovar troca</button>
          </form>
        );
      })()}
      <TicketThread ticketId={t.id} viewerIsStaff />
    </div>
  );
}
