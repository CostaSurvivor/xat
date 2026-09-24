import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { CURRENCY_ICON, SITE_NAME } from "@/lib/config";
import { getPixConfig } from "@/server/settings";
import { requireUser } from "@/server/auth";
import { cancelPayment, claimPayment } from "@/app/actions/wallet";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Pagamento Pix" };

export default async function PixPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const p = await db.payment.findUnique({ where: { id: (await params).id } });
  if (!p || p.userId !== user.id) notFound();
  const brl = (p.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pix = await getPixConfig();
  if (!pix.key && p.provider === "pix_manual") return <div className="card mx-auto max-w-md p-6 text-center">Pagamento via Pix indisponível no momento. Tente mais tarde.</div>;
  const { chargeFor } = await import("@/server/payments");
  const code = await chargeFor(p, user);
  const qr = await QRCode.toDataURL(code, { margin: 1, width: 320, color: { dark: "#000000", light: "#ffffff" } });
  return (
    <div className="card mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Pagar com Pix</h1>
      <p className="text-sm text-mute">{p.kind === "VIP" ? `⭐ Assinatura ${p.packageName} (${p.vipDays} dias)` : `${p.packageName}: ${CURRENCY_ICON} ${p.coins}`} por <b className="text-fg">{brl}</b></p>
      {p.status === "PENDING" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code Pix" className="mx-auto rounded-xl bg-white p-2" width={260} height={260} />
          <div className="rounded-xl bg-panel2 p-3 text-left">
            <p className="label">Pix copia e cola</p>
            <p className="break-all font-mono text-[11px] text-mute">{code}</p>
            <CopyButton text={code} />
          </div>
          <ol className="space-y-1 text-left text-sm text-mute">
            <li>1. Pague <b className="text-fg">exatamente {brl}</b> pelo app do seu banco.</li>
            <li>2. O identificador <b className="font-mono text-gold">{p.code}</b> já vai junto no Pix.</li>
            <li>3. Clique em “Já paguei”. A equipe do {SITE_NAME} confere e libera {p.kind === "VIP" ? "sua assinatura" : `suas ${CURRENCY_ICON}`} (normalmente em minutos).</li>
          </ol>
          <form action={claimPayment.bind(null, p.id)} className="space-y-2">
            <input name="payerName" placeholder="Nome de quem pagou (ajuda na conferência)" className="input" maxLength={120} />
            <button className="btn-gold w-full">✅ Já paguei</button>
          </form>
          <form action={cancelPayment.bind(null, p.id)}><button className="text-xs text-mute underline">Cancelar pedido</button></form>
        </>
      )}
      {p.status === "CLAIMED" && <p className="rounded-xl bg-gold/10 p-4 text-gold2">⏳ Recebemos seu aviso! Estamos conferindo o Pix <b className="font-mono">{p.code}</b>. Você recebe uma notificação quando as {CURRENCY_ICON} forem liberadas.</p>}
      {p.status === "PAID" && <p className="rounded-xl bg-green-100 p-4 text-green-700">✅ Pagamento aprovado! {p.kind === "VIP" ? "Sua assinatura está ativa." : `${CURRENCY_ICON} ${p.coins} creditadas!`}</p>}
      {(p.status === "REJECTED" || p.status === "EXPIRED") && <p className="rounded-xl bg-wine/40 p-4">Este pedido foi {p.status === "REJECTED" ? "recusado" : "cancelado"}.</p>}
    </div>
  );
}
