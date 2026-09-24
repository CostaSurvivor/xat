import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { tradableItems, tradeView } from "@/server/trades";
import { TradeRoom } from "@/components/TradeRoom";

export const metadata = { title: "Troca" };
export const dynamic = "force-dynamic";

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const v = await tradeView((await params).id, user.id);
  if (!v) notFound();
  const [items, balance] = await Promise.all([tradableItems(user.id), balanceOf(user.id)]);
  const vipDays = user.vipUntil ? Math.max(0, Math.floor((user.vipUntil.getTime() - Date.now()) / 86400_000)) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <TradeRoom initial={v} myBalance={balance} myVipDays={vipDays} myItems={items.map((i) => ({ id: i.id, name: i.item.name, category: i.item.category, rarity: i.item.rarity, config: i.item.config }))} />
    </div>
  );
}
