import Link from "next/link";
import { db } from "@/lib/db";
import { compileStyle, serializeStyle } from "@/lib/items";
import { requireUser } from "@/server/auth";
import { toggleItem } from "@/app/actions/shop";
import { Nick } from "@/components/Nick";
import { ItemBadge } from "@/components/ItemBadge";
import { RoleIcon } from "@/components/RoleIcon";

export const metadata = { title: "Meus itens" };

const CAT: Record<string, string> = { DOLL: "🤠 Boneco", GLOW: "✨ Glow", NICK_COLOR: "🎨 Cor do nick", BADGE: "👑 Ícones", AVATAR_FRAME: "🖼️ Molduras", ENTRY_EFFECT: "🎉 Entradas", TEXT_COLOR: "💬 Cor do texto", POWER: "⚡ Poderes" };

export default async function Inventario() {
  const user = await requireUser();
  const inv = await db.inventoryItem.findMany({ where: { userId: user.id }, include: { item: true }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  const activeItems = inv.filter((i) => i.active && (!i.expiresAt || i.expiresAt > now)).map((i) => i.item);
  const activeStyle = serializeStyle(compileStyle(activeItems));
  const cats = [...new Set(inv.map((i) => i.item.category))];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">🎒 Meus itens</h1>
        <Link href="/loja" className="btn-ghost">Loja</Link>
        <Link href="/trocas" className="btn-ghost">🔄 Trocar itens</Link>
      </div>
      <div className="card flex items-center justify-center gap-3 p-5">
        <p className="text-xs uppercase text-mute">Como vocês aparecem no chat:</p>
        <RoleIcon role="MEMBER" size={34} vip={!!user.vipUntil && user.vipUntil > now} accessory={activeStyle.doll} />
        <span className="text-2xl"><Nick nick={user.nick} style={activeStyle} link={false} /></span>
      </div>
      {inv.length === 0 && <p className="text-mute">Nenhum item ainda. <Link href="/loja" className="text-gold underline">Ir para a loja</Link></p>}
      {cats.map((c) => (
        <section key={c} className="card p-4">
          <h2 className="mb-2 font-semibold text-gold">{CAT[c] ?? c}</h2>
          <ul className="divide-y divide-line">
            {inv.filter((i) => i.item.category === c).map((i) => {
              const expired = i.expiresAt && i.expiresAt < now;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                  <ItemBadge name={i.item.name} category={i.item.category} rarity={i.item.rarity} config={i.item.config} nick={user.nick} small />
                  <span className="flex-1 text-xs text-mute">
                    {expired ? "Expirado" : i.expiresAt ? `Até ${i.expiresAt.toLocaleDateString("pt-BR")}` : "Permanente · pode trocar"}
                    {i.giftFrom && " · 🎁 presente"}
                  </span>
                  {!expired && (
                    <form action={toggleItem.bind(null, i.id)}>
                      <button className={i.active ? "btn-gold py-1 text-xs" : "btn-ghost py-1 text-xs"}>{i.active ? "Ativo ✓" : "Ativar"}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
