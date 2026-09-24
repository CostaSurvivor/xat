import { db } from "@/lib/db";
import Link from "next/link";
import { CURRENCY_ICON } from "@/lib/config";
import { getPixConfig } from "@/server/settings";
import { requireAdmin } from "@/server/auth";
import { approvePayment, rejectPayment } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Pagamentos() {
  await requireAdmin();
  const pix = await getPixConfig();
  const [pending, recent] = await Promise.all([
    db.payment.findMany({ where: { status: { in: ["CLAIMED", "PENDING"] } }, include: { user: { select: { nick: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }),
    db.payment.findMany({ where: { status: { in: ["PAID", "REJECTED"] } }, include: { user: { select: { nick: true } } }, orderBy: { reviewedAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pix manual</h1>
      {!pix.key && <p className="rounded-xl bg-red-900/50 p-3 text-sm">⚠️ Chave Pix não configurada: usuários não conseguem gerar QR Code. <Link href="/admin/config" className="underline">Configurar agora</Link></p>}
      <p className="text-sm text-mute">Confira no extrato do banco o valor e o identificador (txid / descrição) antes de aprovar. A aprovação credita as moedas uma única vez.</p>
      <div className="card divide-y divide-line">
        {pending.length === 0 && <p className="p-4 text-sm text-mute">Nada pendente.</p>}
        {pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="font-mono text-gold">{p.code}</span>
            <span>@{p.user.nick}</span>
            <span className="font-semibold">{brl(p.amountCents)}</span>
            <span>{p.kind === "VIP" ? `⭐ VIP ${p.vipDays}d` : `${CURRENCY_ICON}${p.coins}`}</span>
            {p.payerName && <span className="text-mute">pagador: {p.payerName}</span>}
            <span className={p.status === "CLAIMED" ? "text-gold2" : "text-mute"}>{p.status === "CLAIMED" ? "disse que pagou" : "aguardando"}</span>
            <span className="text-xs text-mute">{p.createdAt.toLocaleString("pt-BR")}</span>
            <div className="ml-auto flex gap-2">
              <form action={approvePayment.bind(null, p.id)}><button className="btn-gold py-1 text-xs">Aprovar</button></form>
              <form action={rejectPayment.bind(null, p.id)}><button className="btn-ghost py-1 text-xs">Recusar</button></form>
            </div>
          </div>
        ))}
      </div>
      <h2 className="font-semibold text-gold">Histórico</h2>
      <div className="card divide-y divide-line text-sm">
        {recent.map((p) => (
          <div key={p.id} className="flex gap-3 p-2">
            <span className="font-mono">{p.code}</span><span>@{p.user.nick}</span><span>{brl(p.amountCents)}</span>
            <span className={p.status === "PAID" ? "text-green-300" : "text-red-300"}>{p.status === "PAID" ? "aprovado" : "recusado"}</span>
            <span className="ml-auto text-xs text-mute">{p.reviewedAt?.toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
