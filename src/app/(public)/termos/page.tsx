import { SITE_NAME, TERMS_VERSION } from "@/lib/config";

export const metadata = { title: "Termos de Uso", robots: { index: true, follow: true } };

// Modelo inicial. Revisar com advogado antes do lançamento.
export default function Termos() {
  return (
    <article className="prose-invert mx-auto max-w-3xl space-y-4 card p-6 text-sm leading-relaxed text-mute sm:p-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">Termos de Uso</h1>
      <p>Versão {TERMS_VERSION}. Ao usar o {SITE_NAME} você concorda com estes termos.</p>
      <h2 className="text-lg font-semibold text-fg">1. Somente maiores de 18 anos</h2>
      <p>O acesso é exclusivo para maiores de 18 anos. Perfis de casal exigem que ambas as pessoas sejam maiores. Envio de fotos, mensagens privadas, compras e criação de salas exigem verificação de idade por selfie. Contas de menores são excluídas e reportadas.</p>
      <h2 className="text-lg font-semibold text-fg">2. Tolerância zero</h2>
      <p>É proibido qualquer conteúdo envolvendo menores de idade, mesmo que simulado ou sugerido. Esse conteúdo é removido imediatamente, a conta é banida e os dados são preservados e encaminhados às autoridades competentes (SaferNet Brasil e Polícia Federal), conforme a lei.</p>
      <h2 className="text-lg font-semibold text-fg">3. Consentimento</h2>
      <p>Só publique fotos suas ou de pessoas que consentiram expressamente. É proibido divulgar imagens íntimas de terceiros sem autorização (crime previsto no art. 218-C do Código Penal), fazer prints ou repostar fotos de outros membros. As fotos têm marca d’água que identifica a origem.</p>
      <h2 className="text-lg font-semibold text-fg">4. Conduta</h2>
      <p>Proibido: assédio, ameaças, discurso de ódio, spam, golpes, prostituição ou oferta de serviços sexuais pagos, perfis falsos e divulgação de dados pessoais de terceiros.</p>
      <h2 className="text-lg font-semibold text-fg">5. Moeda virtual e itens</h2>
      <p>A moeda virtual e os itens cosméticos não têm valor monetário fora da plataforma, não são reembolsáveis após o uso e não podem ser convertidos em dinheiro. Contas banidas por violação destes termos perdem saldo e itens.</p>
      <h2 className="text-lg font-semibold text-fg">6. Moderação</h2>
      <p>Donos e moderadores de salas podem silenciar, expulsar e banir usuários das suas salas. A equipe da plataforma pode remover conteúdo e suspender ou banir contas, dispositivos e IPs que violem estes termos.</p>
      <h2 className="text-lg font-semibold text-fg">7. Denúncias</h2>
      <p>Use o botão “Denunciar” disponível em perfis, fotos, comentários e mensagens. Denúncias de possível menor têm prioridade máxima.</p>
    </article>
  );
}
