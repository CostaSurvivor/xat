import { acceptAgeGate } from "@/app/actions/auth";
import { SITE_NAME } from "@/lib/config";

export const metadata = { robots: { index: true, follow: true } };

export default async function AgeGate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-md card p-8 text-center">
      <div className="text-5xl">🔞</div>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold">Conteúdo adulto</h1>
      <p className="mt-3 text-sm text-mute">
        O {SITE_NAME} é uma comunidade liberal exclusiva para <b className="text-fg">maiores de 18 anos</b>, com conversas e imagens de
        natureza sexual entre adultos que consentem. Ao entrar você declara ter 18 anos ou mais e concorda com os termos de uso.
      </p>
      <form action={acceptAgeGate} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="next" value={next || "/"} />
        <button className="btn-gold py-3 text-base">Tenho 18 anos ou mais: entrar</button>
        <a href="https://www.google.com" className="btn-ghost">Sou menor de idade: sair</a>
      </form>
      <p className="mt-6 text-xs text-mute">Tolerância zero com qualquer conteúdo envolvendo menores. Denúncias são encaminhadas às autoridades (SaferNet / Polícia Federal).</p>
    </div>
  );
}
