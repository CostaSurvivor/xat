import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME, SITE_NAME } from "@/lib/config";
import { getPixConfig } from "@/server/settings";
import { isSubscriber, isVerified, requireUser } from "@/server/auth";
import { createVipPayment } from "@/app/actions/wallet";
import Link from "next/link";

export const metadata = { title: "Assinar" };
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Assinar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser();
  const { erro } = await searchParams;
  const pix = await getPixConfig();
  const plans = await db.vipPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const sub = isSubscriber(user) && user.vipUntil;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card bg-gradient-to-br from-wine/60 via-panel to-panel p-6 text-center">
        <p className="text-4xl">⭐</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Assinante {SITE_NAME}</h1>
        <p className="mt-2 text-mute">Todo mundo pode postar fotos e vídeos. <b className="text-white">Assistir aos vídeos</b> é exclusivo de quem assina.</p>
        {sub && <p className="mt-3 rounded-xl bg-gold/15 p-2 text-gold2">Você é assinante até <b>{sub.toLocaleDateString("pt-BR")}</b>. Renovar soma mais dias.</p>}
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {["🎬 Assiste a todos os vídeos do feed e dos perfis", "🏷️ Selo VIP dourado no perfil e nos posts", `${CURRENCY_ICON} ${CURRENCY_NAME} de bônus a cada período`, "💛 Ajuda a manter a comunidade segura e sem anúncios"].map((b) => (
          <li key={b} className="card p-3">{b}</li>
        ))}
      </ul>
      {erro === "pix" && <p className="rounded-xl bg-wine/40 p-3 text-sm">Pagamento temporariamente indisponível.</p>}
      {!isVerified(user) ? (
        <p className="text-sm text-mute">🔒 <Link href="/verificacao" className="text-gold underline">Verifique seu perfil</Link> para assinar.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p, i) => (
            <form key={p.id} action={createVipPayment.bind(null, p.id)} className={`card flex flex-col items-center p-5 text-center ${i === 1 ? "border-gold" : ""}`}>
              {i === 1 && <span className="mb-1 rounded-full bg-gold px-2 text-[10px] font-bold text-ink">MAIS ESCOLHIDO</span>}
              <p className="font-semibold">{p.name}</p>
              <p className="text-3xl font-bold text-gold">{brl(p.priceCents)}</p>
              <p className="text-xs text-mute">{p.days} dias{p.bonusCoins ? ` · +${p.bonusCoins} ${CURRENCY_ICON}` : ""}</p>
              <button disabled={!pix.key} className="btn-gold mt-3 w-full">Assinar com Pix</button>
            </form>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-mute">Sem renovação automática: você paga por período via Pix e renova quando quiser.</p>
    </div>
  );
}
