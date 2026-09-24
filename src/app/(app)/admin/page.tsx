import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/server/auth";
import { roomOnlineCounts } from "@/server/rooms";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Dashboard() {
  await requireStaff();
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const openTickets = await db.ticket.count({ where: { status: "OPEN" } });
  const [online, users, newToday, revDay, revMonth, pendingPix, pendingVerif, openReports, minorReports, counts, top, pendingEvents] = await Promise.all([
    db.user.count({ where: { lastSeenAt: { gt: new Date(Date.now() - 5 * 60_000) } } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { createdAt: { gte: day } } }),
    db.payment.aggregate({ where: { status: "PAID", reviewedAt: { gte: day } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { status: "PAID", reviewedAt: { gte: month } }, _sum: { amountCents: true } }),
    db.payment.count({ where: { status: "CLAIMED" } }),
    db.verificationRequest.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.report.count({ where: { status: "OPEN", reason: "POSSIBLE_MINOR" } }),
    roomOnlineCounts(),
    db.inventoryItem.groupBy({ by: ["itemId"], where: { createdAt: { gte: month } }, _count: true, orderBy: { _count: { itemId: "desc" } }, take: 5 }),
    db.event.count({ where: { status: "PENDING" } }),
  ]);
  const topItems = await db.item.findMany({ where: { id: { in: top.map((t) => t.itemId) } } });
  const Stat = ({ label, value, href, alert }: { label: string; value: string | number; href?: string; alert?: boolean }) => {
    const inner = (
      <div className={`card p-4 ${alert ? "border-red-500/60 bg-red-100" : ""}`}>
        <p className="text-xs uppercase text-mute">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-red-700" : "text-gold"}`}>{value}</p>
      </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
  };
  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Painel</h1>
      {minorReports > 0 && <Link href="/admin/denuncias" className="block rounded-xl bg-red-100 p-3 font-semibold">🚨 {minorReports} denúncia(s) de POSSÍVEL MENOR aguardando análise. Prioridade máxima.</Link>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Online agora" value={online} />
        <Stat label="Salas ativas" value={counts.size} />
        <Stat label="Usuários" value={users} />
        <Stat label="Novos hoje" value={newToday} />
        <Stat label="Receita hoje" value={brl(revDay._sum.amountCents ?? 0)} />
        <Stat label="Receita no mês" value={brl(revMonth._sum.amountCents ?? 0)} />
        <Stat label="Pix a conferir" value={pendingPix} href="/admin/pagamentos" alert={pendingPix > 0} />
        <Stat label="Verificações" value={pendingVerif} href="/admin/verificacoes" alert={pendingVerif > 0} />
        <Stat label="Eventos a aprovar" value={pendingEvents} href="/admin/eventos" alert={pendingEvents > 0} />
        <Stat label="Denúncias abertas" value={openReports} href="/admin/denuncias" alert={openReports > 0} />
        <Stat label="Tickets abertos" value={openTickets} href="/admin/tickets" alert={openTickets > 0} />
      </div>
      <section className="card p-4">
        <h2 className="mb-2 font-semibold text-gold">Itens mais vendidos (mês)</h2>
        {top.length === 0 ? <p className="text-sm text-mute">Sem vendas ainda.</p> : (
          <ol className="list-decimal pl-5 text-sm">{top.map((t) => <li key={t.itemId}>{topItems.find((i) => i.id === t.itemId)?.name}: {t._count}</li>)}</ol>
        )}
      </section>
    </div>
  );
}
