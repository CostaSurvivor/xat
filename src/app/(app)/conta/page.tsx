import Link from "next/link";
import { requireUser } from "@/server/auth";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";

export const metadata = { title: "Meus dados" };

export default async function Conta() {
  await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Meus dados (LGPD)</h1>
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
