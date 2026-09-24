import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/server/auth";
import { TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTickets({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const { status = "OPEN" } = await searchParams;
  const tickets = await db.ticket.findMany({ where: { status }, orderBy: { updatedAt: status === "OPEN" ? "asc" : "desc" }, take: 100, include: { user: { select: { nick: true } } } });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Tickets</h1>
        {Object.entries(TICKET_STATUS).map(([k, v]) => (
          <Link key={k} href={`?status=${k}`} className={`rounded-full px-3 py-1 text-xs ${k === status ? "bg-wine text-white" : "border border-line"}`}>{v.label}</Link>
        ))}
      </div>
      <div className="card divide-y divide-line">
        {tickets.length === 0 && <p className="p-4 text-sm text-mute">Nenhum chamado aqui.</p>}
        {tickets.map((t) => (
          <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-black/5">
            <span className="rounded bg-panel2 px-1.5 text-xs">{TICKET_CATEGORIES[t.category]}</span>
            <span className="min-w-0 flex-1 truncate">{t.subject}</span>
            <span className="text-xs text-mute">@{t.user.nick}</span>
            <span className="text-xs text-mute">{t.updatedAt.toLocaleString("pt-BR")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
