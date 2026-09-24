import Link from "next/link";
import { db } from "@/lib/db";
import { compileStyle, serializeStyle } from "@/lib/items";
import { requireUser } from "@/server/auth";
import { toggleItem } from "@/app/actions/shop";
import { Nick } from "@/components/Nick";

export const metadata = { title: "Meus itens" };

export default async function Inventario() {
  const user = await requireUser();
  const inv = await db.inventoryItem.findMany({ where: { userId: user.id }, include: { item: true }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  const activeStyle = serializeStyle(compileStyle(inv.filter((i) => i.active && (!i.expiresAt || i.expiresAt > now)).map((i) => i.item)));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Meus itens</h1>
      <div className="card p-5 text-center">
        <p className="text-xs uppercase text-mute">Como vocês aparecem no chat</p>
        <p className="mt-2 text-2xl"><Nick nick={user.nick} style={activeStyle} link={false} /></p>
      </div>
      {inv.length === 0 && <p className="text-mute">Nenhum item ainda. <Link href="/loja" className="text-gold underline">Ir para a loja</Link></p>}
      <ul className="card divide-y divide-line">
        {inv.map((i) => {
          const expired = i.expiresAt && i.expiresAt < now;
          return (
            <li key={i.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.item.name}{i.giftFrom && " 🎁"}</p>
                <p className="text-xs text-mute">{expired ? "Expirado" : i.expiresAt ? `Até ${i.expiresAt.toLocaleDateString("pt-BR")}` : "Permanente"}</p>
              </div>
              {!expired && (
                <form action={toggleItem.bind(null, i.id)}>
                  <button className={i.active ? "btn-gold py-1 text-xs" : "btn-ghost py-1 text-xs"}>{i.active ? "Ativo ✓" : "Ativar"}</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
