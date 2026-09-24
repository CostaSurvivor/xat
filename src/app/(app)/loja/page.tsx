import Link from "next/link";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { isVerified, requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { ShopItem } from "@/components/ShopItem";

export const metadata = { title: "Loja" };

const CATS: [string, string][] = [
  ["DOLL", "🤠 Acessórios do boneco"],
  ["GLOW", "✨ Glow neon no nick"],
  ["NICK_COLOR", "🎨 Cor do nick"],
  ["BADGE", "👑 Ícones"],
  ["AVATAR_FRAME", "🖼️ Molduras"],
  ["ENTRY_EFFECT", "🎉 Efeitos de entrada"],
  ["TEXT_COLOR", "💬 Cor do texto"],
  ["POWER", "⚡ Poderes"],
];

export default async function Loja() {
  const user = await requireUser();
  const [items, balance] = await Promise.all([db.item.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { price30: "asc" }] }), balanceOf(user.id)]);
  const canBuy = isVerified(user);
  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-3 bg-gradient-to-r from-wine/50 to-panel p-5">
        <div className="mr-auto">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Loja</h1>
          <p className="text-sm text-mute">Brilhe nas salas. Veja a prévia com o seu nick antes de comprar.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gold">{CURRENCY_ICON} {balance.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-mute">{CURRENCY_NAME}</div>
        </div>
        <Link href="/carteira" className="btn-gold">Recarregar</Link>
        <Link href="/loja/inventario" className="btn-ghost">🎒 Meus itens</Link>
      </div>
      {!canBuy && <p className="rounded-xl bg-wine/40 p-3 text-sm">🔒 <Link href="/verificacao" className="underline">Verifique seu perfil</Link> para comprar itens.</p>}
      {CATS.map(([cat, label]) => {
        const list = items.filter((i) => i.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h2 className="mb-2 font-semibold text-gold">{label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {list.map((i) => (
                <ShopItem
                  key={i.id}
                  nick={user.nick}
                  avatarId={user.avatarId}
                  canBuy={canBuy}
                  item={{ ...i, soldOut: i.limitedQty != null && i.soldCount >= i.limitedQty, left: i.limitedQty != null ? Math.max(0, i.limitedQty - i.soldCount) : null }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
