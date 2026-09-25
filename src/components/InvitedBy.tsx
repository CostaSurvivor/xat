import { cookies } from "next/headers";
import { CURRENCY_ICON } from "@/lib/config";
import { REFERRAL, cleanRefNick } from "@/lib/referral";

/** Faixa "você foi convidado por @nick" (página inicial e cadastro). */
export async function InvitedBy() {
  const nick = cleanRefNick((await cookies()).get(REFERRAL.cookie)?.value);
  if (!nick) return null;
  return (
    <p data-testid="convidado" className="rounded-xl border border-wine/30 bg-pink-50 p-3 text-sm text-fg">
      📣 Você foi convidado por <b>@{nick}</b>: ganha <b>{REFERRAL.inviteeCoins} {CURRENCY_ICON}</b> extras quando verificar o perfil.
    </p>
  );
}
