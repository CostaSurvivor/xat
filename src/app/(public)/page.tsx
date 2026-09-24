import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { SITE_NAME, CURRENCY_NAME } from "@/lib/config";

export default async function Landing() {
  if (await getCurrentUser()) redirect("/feed");
  const features = [
    ["💬", "Salas de chat", "Sala Geral com o Brasil todo, sala só para casais e uma sala para cada estado, com moderação."],
    ["📸", "Fotos protegidas", "Toda foto recebe marca d’água com o nick. No PV, a foto chega borrada e só abre com consentimento."],
    ["✅", "Perfis verificados", "Verificação por selfie com gesto: menos fake, mais gente real."],
    ["✨", "Brilhe no chat", `Glow no nick, coroas, molduras e efeitos de entrada com ${CURRENCY_NAME}.`],
  ];
  return (
    <div className="py-10 text-center sm:py-16 sm:text-left">
      <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-extrabold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,.8)] sm:text-7xl">
        O lugar dos <span className="gold-text italic">casais liberais</span><br />que gostam de conversar.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lg text-white/75 sm:mx-0">Salas de chat, fotos, casais, solteiras e solteiros do meio liberal. Discreto, verificado e 18+.</p>
      <div className="mt-8 flex justify-center gap-3 sm:justify-start">
        <Link href="/cadastro" className="btn-gold px-6 py-3 text-base">Entrar no {SITE_NAME}</Link>
        <Link href="/login" className="btn-ghost px-6 py-3 text-base">Já tenho conta</Link>
      </div>
      <div className="mt-20 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([i, t, d]) => (
          <div key={t} className="card bg-panel/70 p-5 backdrop-blur">
            <div className="text-3xl">{i}</div>
            <h3 className="mt-2 font-semibold text-gold">{t}</h3>
            <p className="mt-1 text-sm text-mute">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
