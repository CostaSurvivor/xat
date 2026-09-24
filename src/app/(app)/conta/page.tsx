import Link from "next/link";
import { requireUser } from "@/server/auth";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { ActionForm } from "@/components/Forms";
import { changePassword } from "@/app/actions/account";

export const metadata = { title: "Meus dados" };

export default async function Conta() {
  await requireUser();
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
