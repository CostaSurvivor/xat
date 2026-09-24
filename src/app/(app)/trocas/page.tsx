import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { startTrade } from "@/app/actions/trade";
import { TRADE_TTL_MS } from "@/server/trades";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Trocas" };
export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = {
  PENDING: ["Em andamento", "bg-gold/20 text-gold2"],
  COMPLETED: ["Concluída", "bg-green-900/50 text-green-300"],
  CANCELLED: ["Cancelada", "bg-panel2 text-mute"],
  EXPIRED: ["Expirada", "bg-panel2 text-mute"],
};

export default async function Trocas({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser();
  const { erro } = await searchParams;
  const trades = await db.trade.findMany({ where: { OR: [{ aId: user.id }, { bId: user.id }] }, orderBy: { updatedAt: "desc" }, take: 50 });
  const others = await db.user.findMany({ where: { id: { in: trades.map((t) => (t.aId === user.id ? t.bId : t.aId)) } }, select: { id: true, nick: true } });
  const nickOf = new Map(others.map((o) => [o.id, o.nick]));
  const errMsg = erro === "nick" ? "Nick não encontrado." : erro === "verif" ? "Só perfis verificados podem trocar." : erro;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🔄 Trocas</h1>
      <section className="card space-y-3 p-5">
        <p className="text-sm text-mute">Troque Pimentas, <b className="text-white">itens permanentes</b> e dias de assinatura com segurança: cada lado monta a oferta, os dois aceitam e confirmam com a senha. Qualquer mudança zera os aceites.</p>
        <form action={async (fd) => { "use server"; await startTrade(String(fd.get("nick") || "")); }} className="flex gap-2">
          <input name="nick" required placeholder="@nick de quem você quer trocar" className="input" />
          <button className="btn-gold whitespace-nowrap">Propor troca</button>
        </form>
        {errMsg && <p className="text-sm text-red-300">{errMsg}</p>}
      </section>
      <section className="card divide-y divide-line">
        {trades.length === 0 && <p className="p-5 text-center text-sm text-mute">Nenhuma troca ainda.</p>}
        {trades.map((t) => {
          const status = t.status === "PENDING" && Date.now() - t.createdAt.getTime() > TRADE_TTL_MS ? "EXPIRED" : t.status;
          return (
            <Link key={t.id} href={`/trocas/${t.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-white/5">
              <span className="flex-1">Troca com <b>@{nickOf.get(t.aId === user.id ? t.bId : t.aId)}</b> {t.aId === user.id ? "(você propôs)" : "(proposta recebida)"}</span>
              <span className="text-xs text-mute">{timeAgo(t.updatedAt)}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${ST[status][1]}`}>{ST[status][0]}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
