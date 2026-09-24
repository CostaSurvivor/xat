import Link from "next/link";
import { requireUser } from "@/server/auth";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { ActionForm } from "@/components/Forms";
import { changePassword, confirm2fa, disable2fa, start2fa } from "@/app/actions/account";
import QRCode from "qrcode";

export const metadata = { title: "Meus dados" };

export default async function Conta() {
  const user = await requireUser();
  let qr: string | null = null;
  if (user.twoFactorSecret && !user.twoFactorEnabled) {
    const { totpFor } = await import("@/server/totp");
    qr = await QRCode.toDataURL(totpFor(user.twoFactorSecret, user.email).toString(), { margin: 1, width: 200 });
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Conta e dados</h1>
      <section className="card space-y-2 p-5">
        <h2 className="font-semibold text-gold">Trocar senha</h2>
        <ActionForm action={changePassword} className="space-y-2" okText="Senha alterada! Outras sessões foram encerradas." resetOnOk>
          <input name="current" type="password" required placeholder="Senha atual" className="input" autoComplete="current-password" />
          <input name="next" type="password" required minLength={8} placeholder="Nova senha (8+ caracteres)" className="input" autoComplete="new-password" />
          <input name="confirm" type="password" required minLength={8} placeholder="Repita a nova senha" className="input" autoComplete="new-password" />
          <button className="btn-gold">Salvar nova senha</button>
        </ActionForm>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold text-gold">🛡️ Verificação em duas etapas (2FA)</h2>
        {user.twoFactorEnabled ? (
          <>
            <p className="text-sm text-green-300">Ativada. Ao entrar, será pedido o código do app autenticador.</p>
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
        <h2 className="font-semibold text-red-300">Excluir conta</h2>
        <p className="text-sm text-mute">
          Apaga perfil, fotos, posts, comentários e mensagens. Saldo e itens são perdidos. Por obrigação legal mantemos registros de acesso por 6 meses
          (Marco Civil), registros de pagamentos e evidências de denúncias encaminhadas às autoridades. Veja a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
