import { SITE_NAME, TERMS_VERSION } from "@/lib/config";

export const metadata = { title: "Política de Privacidade" };

// Modelo inicial. Revisar com advogado / encarregado (DPO) antes do lançamento.
export default function Privacidade() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 card p-6 text-sm leading-relaxed text-mute sm:p-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">Política de Privacidade</h1>
      <p>Versão {TERMS_VERSION}. Esta política explica como o {SITE_NAME} trata seus dados conforme a LGPD (Lei 13.709/2018).</p>
      <h2 className="text-lg font-semibold text-fg">Dados que coletamos</h2>
      <ul className="list-disc pl-5">
        <li>Cadastro: e-mail, nick, datas de nascimento, cidade/UF, senha (armazenada apenas como hash argon2).</li>
        <li><b className="text-fg">Dados sensíveis</b> (art. 11): tipo de perfil, preferências e fotos, tratados somente com seu consentimento específico.</li>
        <li>Login com Google (opcional): recebemos do Google apenas seu e-mail e um identificador da conta. Não publicamos nada no seu Google nem acessamos contatos ou outros dados. Você pode desvincular em Conta.</li>
        <li>Selfie de verificação: usada apenas para confirmar maioridade e autenticidade; acesso restrito à moderação.</li>
        <li>Registros de acesso (IP, porta, data e hora): guardados por 6 meses, conforme o art. 15 do Marco Civil da Internet.</li>
      </ul>
      <h2 className="text-lg font-semibold text-fg">Seus direitos</h2>
      <p>Em <b className="text-fg">Conta → Privacidade</b> você pode baixar uma cópia dos seus dados e excluir sua conta. Ao excluir, apagamos perfil, fotos e mensagens, exceto registros que a lei nos obriga a manter (registros de acesso por 6 meses, transações financeiras e evidências de denúncias encaminhadas às autoridades).</p>
      <h2 className="text-lg font-semibold text-fg">Compartilhamento</h2>
      <p>Não vendemos seus dados. Compartilhamos apenas quando exigido por lei ou ordem judicial, ou para reportar crimes contra menores.</p>
      <h2 className="text-lg font-semibold text-fg">Contato</h2>
      <p>Encarregado de dados: {process.env.DPO_EMAIL || "privacidade@seudominio.com.br"}</p>
    </article>
  );
}
