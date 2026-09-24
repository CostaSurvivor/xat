import Link from "next/link";
import { requireUser } from "@/server/auth";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { ActionForm } from "@/components/Forms";
import { confirm2fa, disable2fa, start2fa, unlinkGoogle } from "@/app/actions/account";
import { PasswordForm } from "@/components/PasswordForm";
import { GoogleButton } from "@/components/GoogleButton";
import { hasPassword } from "@/lib/oauth";
import { googleEnabled } from "@/server/google";
import QRCode from "qrcode";

export const metadata = { title: "Meus dados" };

const GOOGLE_MSG: Record<string, string> = { vinculado: "✅ Google vinculado! Agora você pode entrar com ele.", "em-uso": "Esse Google já está vinculado a outra conta." };

export default async function Conta({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requireUser();
  const { google: googleMsg } = await searchParams;
  let qr: string | null = null;
  if (user.twoFactorSecret && !user.twoFactorEnabled) {
    const { totpFor } = await import("@/server/totp");
    qr = await QRCode.toDataURL(totpFor(user.twoFactorSecret, user.email).toString(), { margin: 1, width: 200 });
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Conta e dados</h1>
      <section className="card space-y-2 p-5">
        <h2 className="font-semibold text-gold">{hasPassword(user) ? "Trocar senha" : "Definir senha"}</h2>
        <PasswordForm hasPassword={hasPassword(user)} />
      </section>
      {(googleEnabled() || user.googleSub) && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-gold">Login com Google</h2>
          {googleMsg && GOOGLE_MSG[googleMsg] && <p className="text-sm text-gold2">{GOOGLE_MSG[googleMsg]}</p>}
          {user.googleSub ? (
            <>
              <p className="text-sm text-green-700">Vinculado. Você pode entrar com o Google{hasPassword(user) ? " ou com e-mail e senha" : ""}.</p>
              {hasPassword(user) ? (
                <ActionForm action={unlinkGoogle} className="flex flex-wrap gap-2" okText="Google desvinculado.">
                  <input name="password" type="password" required placeholder="Sua senha" className="input w-48" autoComplete="current-password" />
                  <button className="btn-ghost">Desvincular Google</button>
                </ActionForm>
              ) : (
                <p className="text-xs text-mute">Para desvincular, defina uma senha acima primeiro.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-mute">Vincule sua conta Google para entrar com um clique. Seu e-mail e senha continuam funcionando.</p>
              <div className="max-w-xs"><GoogleButton label="Vincular Google" href="/api/auth/google/start?modo=vincular" /></div>
            </>
          )}
        </section>
      )}
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold text-gold">🛡️ Verificação em duas etapas (2FA)</h2>
        {user.twoFactorEnabled ? (
          <>
            <p className="text-sm text-green-700">Ativada. Ao entrar, será pedido o código do app autenticador.</p>
            <ActionForm action={disable2fa} className="flex flex-wrap gap-2" okText="2FA desativada.">
              <input name="code" inputMode="numeric" required placeholder="código atual" className="input w-36" />
              <button className="btn-ghost">Desativar</button>
            </ActionForm>
          </>
        ) : qr ? (
          <>
            <p className="text-sm text-mute">1) Escaneie no Google Authenticator, Authy ou similar. 2) Digite o código que aparecer.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR 2FA" width={180} height={180} className="rounded-lg bg-white p-1" />
            <p className="break-all font-mono text-[11px] text-mute">Chave manual: {user.twoFactorSecret}</p>
            <ActionForm action={confirm2fa} className="flex flex-wrap gap-2" okText="2FA ativada! 🎉">
              <input name="code" inputMode="numeric" required placeholder="000000" className="input w-36 text-center tracking-widest" />
              <button className="btn-gold">Ativar</button>
            </ActionForm>
          </>
        ) : (
          <form action={start2fa}><button className="btn-gold">Ativar 2FA</button></form>
        )}
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="font-semibold text-gold">Baixar meus dados</h2>
        <p className="text-sm text-mute">Arquivo com perfil, posts, mensagens enviadas, compras, consentimentos e registros de acesso.</p>
        <a href="/api/me/export" className="btn-gold">⬇️ Baixar (JSON)</a>
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="font-semibold text-red-700">Excluir conta</h2>
        <p className="text-sm text-mute">
          Apaga perfil, fotos, posts, comentários e mensagens. Saldo e itens são perdidos. Por obrigação legal mantemos registros de acesso por 6 meses
          (Marco Civil), registros de pagamentos e evidências de denúncias encaminhadas às autoridades. Veja a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
