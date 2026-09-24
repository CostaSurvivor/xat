import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/tickets";
import { NewTicketForm } from "@/components/TicketForms";

export const metadata = { title: "Suporte" };
export const dynamic = "force-dynamic";

export default async function Suporte({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const user = await requireUser();
  const { novo } = await searchParams;
  const tickets = await db.ticket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 50 });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🎫 Suporte</h1>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-gold">Abrir chamado</h2>
        <NewTicketForm initialCategory={novo} />
      </section>
      {tickets.length > 0 && (
        <section className="card divide-y divide-line">
          <h2 className="px-4 py-2 text-sm font-semibold text-gold">Meus chamados</h2>
          {tickets.map((t) => (
            <Link key={t.id} href={`/suporte/${t.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-black/5">
              <span className="min-w-0 flex-1 truncate">{t.subject}<span className="ml-2 text-xs text-mute">{TICKET_CATEGORIES[t.category]}</span></span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${TICKET_STATUS[t.status].cls}`}>{TICKET_STATUS[t.status].label}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
