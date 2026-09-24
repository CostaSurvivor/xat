import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { isVerified, requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { ShopItem } from "@/components/ShopItem";

export const metadata = { title: "Loja" };
export const dynamic = "force-dynamic";

const CATS: [string, string][] = [
  ["destaques", "⭐ Destaques"],
  ["DOLL", "🤠 Boneco"],
  ["GLOW", "✨ Glow neon"],
  ["NICK_COLOR", "🎨 Cor do nick"],
  ["BADGE", "👑 Ícones"],
  ["AVATAR_FRAME", "🖼️ Molduras"],
  ["ENTRY_EFFECT", "🎉 Entradas"],
  ["TEXT_COLOR", "💬 Cor do texto"],
  ["POWER", "⚡ Poderes"],
];
const RARITIES: [string, string][] = [["", "Todas"], ["COMMON", "Comum"], ["RARE", "Raro"], ["EPIC", "Épico"], ["LEGENDARY", "Lendário"], ["LIMITED", "Limitado"]];

export default async function Loja({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; r?: string }> }) {
  const user = await requireUser();
  const { cat = "destaques", q = "", r = "" } = await searchParams;
  const where: Prisma.ItemWhereInput = { active: true };
  if (cat !== "destaques") where.category = cat as Prisma.ItemWhereInput["category"];
  if (q) where.name = { contains: q };
  if (r) where.rarity = r as Prisma.ItemWhereInput["rarity"];

  const [items, balance, owned] = await Promise.all([
    db.item.findMany({ where, orderBy: [{ category: "asc" }, { price30: "asc" }] }),
    balanceOf(user.id),
    db.inventoryItem.findMany({ where: { userId: user.id }, select: { itemId: true, expiresAt: true } }),
  ]);
  const ownedMap = new Map<string, Date | null>();
  for (const o of owned) {
    const prev = ownedMap.get(o.itemId);
    if (prev === null) continue;
    if (o.expiresAt === null || !prev || o.expiresAt > prev) ownedMap.set(o.itemId, o.expiresAt);
  }
  const canBuy = isVerified(user);
  const view = (i: (typeof items)[number]) => ({
    ...i,
    soldOut: i.limitedQty != null && i.soldCount >= i.limitedQty,
    left: i.limitedQty != null ? Math.max(0, i.limitedQty - i.soldCount) : null,
    owned: ownedMap.has(i.id) ? (ownedMap.get(i.id) === null ? "Permanente" : ownedMap.get(i.id)! > new Date() ? `Até ${ownedMap.get(i.id)!.toLocaleDateString("pt-BR")}` : null) : null,
  });
  const Grid = ({ list }: { list: typeof items }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((i) => <ShopItem key={i.id} nick={user.nick} avatarId={user.avatarId} canBuy={canBuy} item={view(i)} />)}
    </div>
  );
  const featured = cat === "destaques" && !q && !r;
  const top = [...items].sort((a, b) => b.soldCount - a.soldCount).slice(0, 4);
  const news = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4);
  const limited = items.filter((i) => i.limitedQty != null && i.soldCount < i.limitedQty).slice(0, 4);
  const qs = (o: Record<string, string>) => new URLSearchParams({ cat, ...(q ? { q } : {}), ...(r ? { r } : {}), ...o }).toString();

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 bg-gradient-to-r from-wine/60 via-panel to-panel p-5">
        <div className="mr-auto">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Loja</h1>
          <p className="text-sm text-mute">Glow, bonecos, ícones e poderes para brilhar nas salas. Itens permanentes podem ser trocados.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gold">{CURRENCY_ICON} {balance.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-mute">{CURRENCY_NAME}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/carteira" className="btn-gold">Recarregar</Link>
          <Link href="/loja/inventario" className="btn-ghost">🎒 Meus itens</Link>
          <Link href="/trocas" className="btn-ghost">🔄 Trocas</Link>
          <Link href="/assinar" className="btn-ghost">⭐ Assinar</Link>
        </div>
      </div>
      {!canBuy && <p className="rounded-xl bg-wine/40 p-3 text-sm">🔒 <Link href="/verificacao" className="underline">Verifique seu perfil</Link> para comprar itens.</p>}

      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        {CATS.map(([k, l]) => (
          <Link key={k} href={`/loja?${new URLSearchParams({ cat: k }).toString()}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${cat === k ? "bg-wine text-white" : "border border-line text-mute hover:text-fg"}`}>{l}</Link>
        ))}
      </nav>
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="cat" value={cat} />
        <input name="q" defaultValue={q} placeholder="Buscar item…" className="input max-w-xs" />
        <select name="r" defaultValue={r} className="input w-auto">{RARITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="btn-ghost">Filtrar</button>
      </form>

      {featured ? (
        <>
          {limited.length > 0 && (<section><h2 className="mb-2 font-semibold text-red-700">⏳ Edição limitada</h2><Grid list={limited} /></section>)}
          <section><h2 className="mb-2 font-semibold text-gold">🔥 Mais vendidos</h2><Grid list={top} /></section>
          <section><h2 className="mb-2 font-semibold text-gold">✨ Novidades</h2><Grid list={news} /></section>
          <p className="text-center text-sm text-mute">Veja todos os itens nas abas acima.</p>
        </>
      ) : items.length === 0 ? (
        <p className="text-mute">Nenhum item encontrado. <Link href={`/loja?${qs({ q: "", r: "" })}`} className="underline">Limpar filtros</Link></p>
      ) : (
        <Grid list={items} />
      )}
    </div>
  );
}
