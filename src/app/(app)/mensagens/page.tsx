export const metadata = { title: "Mensagens" };

/** Área da direita quando nenhuma conversa está aberta (só aparece no desktop). */
export default function MensagensHome() {
  return (
    <section className="card hidden flex-col items-center justify-center gap-2 p-8 text-center md:flex">
      <div className="text-5xl">💬</div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Suas conversas privadas</h2>
      <p className="max-w-sm text-sm text-mute">Escolha uma conversa ao lado. Fotos chegam borradas e só abrem quando você quiser, com marca d’água do seu nick.</p>
    </section>
  );
}
