import Link from "next/link";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { getPixConfig } from "@/server/settings";
import { isVerified, requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { applyCoupon, createPixPayment } from "@/app/actions/wallet";
import { ActionForm } from "@/components/Forms";
import { cookies } from "next/headers";

export const metadata = { title: "Carteira" };

const TX_PT: Record<string, string> = {
  PURCHASE_CREDIT: "Recarga Pix", VIP_BONUS: "Bônus de assinatura", ITEM_PURCHASE: "Compra na loja", GIFT_COINS: "Presente", GIFT_ITEM: "Item de presente", ADMIN_ADJUSTMENT: "Ajuste", REFUND: "Estorno",
};
const ST_PT: Record<string, string> = { PENDING: "Aguardando pagamento", CLAIMED: "Em conferência", PAID: "Aprovado", REJECTED: "Recusado", EXPIRED: "Cancelado" };
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Carteira({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser();
  const { erro } = await searchParams;
  const pix = await getPixConfig();
  const cupom = (await cookies()).get("cupom")?.value;
  const coupon = cupom ? await db.coupon.findUnique({ where: { code: cupom } }) : null;
  const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
  const [balance, packages, payments, entries] = await Promise.all([
    balanceOf(user.id),
    db.coinPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    wallet ? db.ledgerEntry.findMany({ where: { walletId: wallet.id }, include: { transaction: true }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card bg-gradient-to-r from-wine/50 to-panel p-6 text-center">
        <p className="text-sm text-mute">Seu saldo</p>
        <p className="text-4xl font-bold text-gold">{CURRENCY_ICON} {balance.toLocaleString("pt-BR")}</p>
        <p className="text-sm text-mute">{CURRENCY_NAME}</p>
      </div>
      {erro === "pix" && <p className="rounded-xl bg-wine/40 p-3 text-sm">Recarga temporariamente indisponível. Fale com a administração.</p>}
      {erro === "limite" && <p className="rounded-xl bg-wine/40 p-3 text-sm">Muitos pedidos seguidos. Aguarde um pouco.</p>}
      <section>
        <h2 className="mb-2 font-semibold text-gold">Recarregar via Pix</h2>
        <ActionForm action={applyCoupon} className="mb-3 flex flex-wrap items-center gap-2" okText={coupon ? `Cupom ${coupon.code} aplicado: +${coupon.bonusPercent}% de ${CURRENCY_NAME}!` : "Cupom removido."}>
          <input name="code" defaultValue={cupom ?? ""} placeholder="Tem cupom?" className="input w-40 py-1.5 uppercase" />
          <button className="btn-ghost py-1.5 text-xs">Aplicar</button>
          {coupon && <span className="text-xs text-green-300">🎟️ {coupon.code}: +{coupon.bonusPercent}% nas próximas recargas</span>}
        </ActionForm>
        {!isVerified(user) ? (
          <p className="text-sm text-mute">🔒 <Link href="/verificacao" className="text-gold underline">Verifique seu perfil</Link> para recarregar.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {packages.map((p) => (
              <form key={p.id} action={createPixPayment.bind(null, p.id)} className="card flex flex-col items-center p-4 text-center">
                <p className="text-sm text-mute">{p.name}</p>
                <p className="text-2xl font-bold">{CURRENCY_ICON} {p.coins}</p>
                {p.bonusCoins > 0 && <p className="text-xs text-green-300">+{p.bonusCoins} bônus</p>}
                {coupon && <p className="text-xs text-gold2">+{Math.floor((p.coins * coupon.bonusPercent) / 100)} do cupom</p>}
                <button className="btn-gold mt-3 w-full" disabled={!pix.key}>{brl(p.priceCents)}</button>
              </form>
            ))}
          </div>
        )}
      </section>
      {payments.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold text-gold">Minhas compras</h2>
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className="font-mono text-xs text-mute">{p.code}</span>
                <span className="flex-1">{p.kind === "VIP" ? `⭐ ${p.packageName}` : `${p.packageName} · ${CURRENCY_ICON}${p.coins}`} · {brl(p.amountCents)}</span>
                {p.status === "PENDING" ? <Link href={`/carteira/pix/${p.id}`} className="text-gold underline">{ST_PT[p.status]}</Link> : <span className={p.status === "PAID" ? "text-green-300" : "text-mute"}>{ST_PT[p.status]}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-2 font-semibold text-gold">Extrato</h2>
        {entries.length === 0 ? <p className="text-sm text-mute">Sem movimentações.</p> : (
          <ul className="divide-y divide-line text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <span className="flex-1">{TX_PT[e.transaction.type] ?? e.transaction.type}{e.transaction.note && e.transaction.type === "ADMIN_ADJUSTMENT" ? ` · ${e.transaction.note}` : ""}</span>
                <span className="text-xs text-mute">{e.createdAt.toLocaleString("pt-BR")}</span>
                <span className={`w-20 text-right font-semibold ${e.amount > 0 ? "text-green-300" : "text-red-300"}`}>{e.amount > 0 ? "+" : ""}{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
