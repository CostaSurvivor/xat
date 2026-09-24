import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Histórico do usuário: punições, denúncias, pagamentos e acessos (para a moderação). */
export default async function UserHistory({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const id = (await params).id;
  const u = await db.user.findUnique({ where: { id } });
  if (!u) notFound();
  const [audits, reportsAgainst, reportsBy, roomSanctions, payments, access] = await Promise.all([
    db.auditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.report.findMany({ where: { targetUserId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.report.count({ where: { reporterId: id } }),
    db.roomSanction.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { room: { select: { slug: true } } } }),
    db.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.accessLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="card p-4"><h2 className="mb-2 font-semibold text-gold">{title}</h2><div className="space-y-1 text-sm">{children}</div></section>
  );
  return (
    <div className="space-y-4">
      <Link href="/admin/usuarios" className="text-sm text-mute">← usuários</Link>
      <h1 className="text-xl font-bold">@{u.nick} <span className="text-sm text-mute">{u.email} · {u.status} · criado em {u.createdAt.toLocaleDateString("pt-BR")}</span></h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Box title={`Ações da equipe (${audits.length})`}>
          {audits.length === 0 && <p className="text-mute">Nada registrado.</p>}
          {audits.map((a) => <p key={a.id.toString()}><span className="text-mute">{a.createdAt.toLocaleString("pt-BR")}</span> · {a.action}</p>)}
        </Box>
        <Box title={`Denúncias contra (${reportsAgainst.length}) · feitas por ele(a): ${reportsBy}`}>
          {reportsAgainst.map((r) => <p key={r.id}><span className="text-mute">{r.createdAt.toLocaleDateString("pt-BR")}</span> · {r.reason} · {r.status}</p>)}
        </Box>
        <Box title="Punições em salas">
          {roomSanctions.length === 0 && <p className="text-mute">Nenhuma.</p>}
          {roomSanctions.map((s) => <p key={s.id}>{s.type === "BAN" ? "🚫" : "🔇"} /{s.room.slug} · {s.createdAt.toLocaleDateString("pt-BR")}{s.reason ? ` · ${s.reason}` : ""}{s.revokedAt ? " · revogado" : ""}</p>)}
        </Box>
        <Box title="Pagamentos">
          {payments.map((p) => <p key={p.id}>{p.code} · {(p.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {p.kind} · {p.status}</p>)}
        </Box>
        <Box title="Últimos acessos (IP / porta)">
          {access.map((a) => <p key={a.id.toString()} className="font-mono text-xs">{a.createdAt.toLocaleString("pt-BR")} · {a.event} · {a.ip}{a.port ? `:${a.port}` : ""}</p>)}
        </Box>
      </div>
    </div>
  );
}
