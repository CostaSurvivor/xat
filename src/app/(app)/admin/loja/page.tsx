import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth";
import { savePackage, saveVipPlan, toggleItemActive } from "@/app/actions/admin";
import { ItemEditor } from "@/components/ItemEditor";

export const dynamic = "force-dynamic";

export default async function AdminLoja() {
  await requireAdmin();
  const [items, packages, plans] = await Promise.all([db.item.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }), db.coinPackage.findMany({ orderBy: { sortOrder: "asc" } }), db.vipPlan.findMany({ orderBy: { sortOrder: "asc" } })]);
  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold text-gold">⭐ Planos de assinatura</h2>
        {[...plans, null].map((p) => (
          <form key={p?.id ?? "new"} action={saveVipPlan} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="id" value={p?.id ?? ""} />
            <input name="name" defaultValue={p?.name} placeholder="Nome" className="input w-32" />
            <input name="days" type="number" defaultValue={p?.days} placeholder="dias" className="input w-20" />
            <input name="bonusCoins" type="number" defaultValue={p?.bonusCoins ?? 0} placeholder="bônus" className="input w-20" />
            <input name="price" defaultValue={p ? (p.priceCents / 100).toFixed(2) : ""} placeholder="R$" className="input w-24" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> ativo</label>
            <button className="btn-ghost py-1 text-xs">{p ? "Salvar" : "+ Criar"}</button>
          </form>
        ))}
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold text-gold">Pacotes de moeda</h2>
        {[...packages, null].map((p) => (
          <form key={p?.id ?? "new"} action={savePackage} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="id" value={p?.id ?? ""} />
            <input name="name" defaultValue={p?.name} placeholder="Nome" className="input w-32" />
            <input name="coins" type="number" defaultValue={p?.coins} placeholder="moedas" className="input w-24" />
            <input name="bonusCoins" type="number" defaultValue={p?.bonusCoins ?? 0} placeholder="bônus" className="input w-20" />
            <input name="price" defaultValue={p ? (p.priceCents / 100).toFixed(2) : ""} placeholder="R$" className="input w-24" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> ativo</label>
            <button className="btn-ghost py-1 text-xs">{p ? "Salvar" : "+ Criar"}</button>
          </form>
        ))}
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold text-gold">Novo item / editar por slug</h2>
        <ItemEditor />
      </section>
      <section className="card divide-y divide-line">
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 p-2 text-sm">
            <span className="w-28 text-xs text-mute">{i.category}</span>
            <b>{i.name}</b>
            <span className="font-mono text-xs text-mute">{i.slug}</span>
            <span className="text-xs">7d:{i.price7 ?? "–"} 30d:{i.price30 ?? "–"} ∞:{i.pricePerm ?? "–"}</span>
            <span className="text-xs text-mute">vendidos: {i.soldCount}{i.limitedQty ? `/${i.limitedQty}` : ""}</span>
            <form action={toggleItemActive.bind(null, i.id)} className="ml-auto"><button className={i.active ? "btn-ghost py-1 text-xs" : "btn-wine py-1 text-xs"}>{i.active ? "Desativar" : "Ativar"}</button></form>
          </div>
        ))}
      </section>
    </div>
  );
}
