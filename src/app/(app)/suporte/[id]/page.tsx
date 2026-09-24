import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { TicketThread } from "@/components/TicketThread";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const t = await db.ticket.findUnique({ where: { id: (await params).id } });
  if (!t || t.userId !== user.id) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href="/suporte" className="text-sm text-mute">← meus chamados</Link>
      <TicketThread ticketId={t.id} viewerIsStaff={false} />
    </div>
  );
}
