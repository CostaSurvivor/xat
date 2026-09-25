import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { SITE_NAME, CURRENCY_NAME } from "@/lib/config";
import { fmtEventDate } from "@/lib/events";
import { welcomeOffer } from "@/server/welcome";
import { WelcomePromo } from "@/components/WelcomePromo";

export const dynamic = "force-dynamic";

const FEATURES: [string, string, string][] = [
  ["💬", "Salas de chat", "Sala Geral com o Brasil todo, sala só para casais e uma sala para cada estado, com moderação."],
  ["💘", "Paquera com match", "Curta perfis e, quando a curtida é dos dois lados, dá match e a conversa começa."],
  ["⏳", "Stories de 24 h", "Fotos que somem em um dia, para todos ou só para amigos."],
  ["📖", "Contos eróticos", "Histórias reais e fantasias da comunidade, por categoria, com curtidas e comentários."],
  ["🎉", "Eventos e festas", "Festas liberais e encontros divulgados pela comunidade, aprovados pela equipe."],
  ["✈️", "Modo Viagem", "Vai viajar? Apareça para quem mora no destino e veja quem está chegando na sua cidade."],
  ["🔥", "Afinidade", "Veja quanto vocês combinam pelo que curtem e encontre perfis parecidos com vocês."],
  ["🫂", "Grupos", "Grupos por interesse para conversar com quem curte o mesmo que vocês."],
  ["🔴", "Ao vivo", "Transmissões ao vivo com chat e presentes."],
  ["✅", "Perfis verificados", "Verificação por selfie com gesto e selo 🤝 Confirmado por quem conheceu pessoalmente."],
  ["📸", "Fotos protegidas", "Marca d’água com o nick, álbuns privados e foto no PV borrada até você aceitar."],
  ["🔒", "Privacidade de verdade", "Saída rápida, bloqueio por PIN, notificações discretas e esconder cidade ou perfil."],
];

const STEPS: [string, string][] = [
  ["Crie sua conta", "Grátis, em um minuto. Perfil de casal, solteira ou solteiro."],
  ["Verifique o perfil", "Uma selfie com um gesto confirma que vocês são reais e maiores de 18."],
  ["Converse e marque", "Salas, PV, paquera, eventos e viagens: o resto é com vocês."],
];

const FAQ: [string, string][] = [
  ["É grátis?", `Sim. Criar conta, conversar nas salas e usar o PV é grátis. ${CURRENCY_NAME} e a assinatura VIP são opcionais.`],
  ["É discreto?", "Nada aparece para quem não tem conta. Você escolhe esconder a cidade, esconder o perfil de quem não é verificado, usar PIN e saída rápida."],
  ["Quem pode entrar?", "Só maiores de 18 anos. A verificação por selfie mantém o site com gente real."],
  [`O que são ${CURRENCY_NAME}?`, "A moeda do site: dá para enfeitar o nick, dar presentes, destacar o perfil e muito mais."],
];

export default async function Landing() {
  if (await getCurrentUser()) redirect("/feed");
  const since = new Date(Date.now() - 3 * 60_000);
  const [offer, rooms, online, events, verified, contos] = await Promise.all([
    welcomeOffer(),
    db.room.count({ where: { isOfficial: true } }),
    db.roomPresence.groupBy({ by: ["roomId"], where: { lastSeenAt: { gt: since } }, _count: { _all: true } }),
    db.event.findMany({ where: { status: "APPROVED", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 3, select: { id: true, title: true, city: true, state: true, startsAt: true } }),
    db.user.count({ where: { status: "ACTIVE", ageVerification: "APPROVED" } }),
    db.conto.count({ where: { deletedAt: null } }),
  ]);
  const onlineNow = online.reduce((n, r) => n + r._count._all, 0);
  const busy = online.sort((a, b) => b._count._all - a._count._all).slice(0, 4);
  const busyRooms = busy.length ? await db.room.findMany({ where: { id: { in: busy.map((r) => r.roomId) }, isOfficial: true }, select: { id: true, name: true } }) : [];
  // números só aparecem quando já impressionam (site novo não exibe "2 perfis")
  const stats = [
    [String(rooms), "salas de chat"],
    ["27", "estados com sala própria"],
    ...(onlineNow >= 5 ? [[String(onlineNow), "pessoas nas salas agora"]] : []),
    ...(verified >= 50 ? [[verified.toLocaleString("pt-BR"), "perfis verificados"]] : []),
    ...(contos >= 20 ? [[String(contos), "contos publicados"]] : []),
  ];

  return (
    <div className="space-y-16 py-8 sm:py-12">
      <section className="text-center sm:text-left">
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-extrabold leading-tight sm:text-7xl">
          O lugar dos <span className="gold-text italic">casais liberais</span><br />que gostam de conversar.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fg/75 sm:mx-0">Salas de chat, paquera, contos, eventos e viagens: casais, solteiras e solteiros do meio liberal. Discreto, verificado e 18+.</p>
        <div className="mt-8 flex justify-center gap-3 sm:justify-start">
          <Link href="/cadastro" className="btn-gold px-6 py-3 text-base">Criar conta grátis</Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">Já tenho conta</Link>
        </div>
      </section>

      <WelcomePromo offer={offer} />

      <section aria-label="Números" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([n, l]) => (
          <div key={l} className="card bg-panel/80 p-4 text-center backdrop-blur">
            <div className="text-3xl font-extrabold text-wine">{n}</div>
            <div className="text-xs text-mute">{l}</div>
          </div>
        ))}
      </section>

      <section aria-label="O que você encontra">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl font-bold">O que você encontra no {SITE_NAME}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([i, t, d]) => (
            <div key={t} className="card bg-panel/80 p-5 backdrop-blur">
              <div className="text-3xl">{i}</div>
              <h3 className="mt-2 font-semibold text-gold">{t}</h3>
              <p className="mt-1 text-sm text-mute">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {(busyRooms.length > 0 || events.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {busyRooms.length > 0 && (
            <div className="card bg-panel/80 p-5 backdrop-blur">
              <h2 className="mb-3 font-semibold">🟢 Salas movimentadas agora</h2>
              <ul className="space-y-2 text-sm">
                {busy.filter((r) => busyRooms.some((x) => x.id === r.roomId)).map((r) => (
                  <li key={r.roomId} className="flex justify-between"><span>{busyRooms.find((x) => x.id === r.roomId)!.name}</span><span className="text-mute">{r._count._all} online</span></li>
                ))}
              </ul>
            </div>
          )}
          {events.length > 0 && (
            <div className="card bg-panel/80 p-5 backdrop-blur">
              <h2 className="mb-3 font-semibold">🎉 Próximos eventos</h2>
              <ul className="space-y-2 text-sm">
                {events.map((e) => <li key={e.id}><span className="font-medium">{e.title}</span> <span className="text-mute">· {e.city}/{e.state} · {fmtEventDate(e.startsAt)}</span></li>)}
              </ul>
              <p className="mt-3 text-xs text-mute">Crie sua conta para ver os detalhes e confirmar presença.</p>
            </div>
          )}
        </section>
      )}

      <section aria-label="Como funciona">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl font-bold">Como funciona</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card bg-panel/80 p-5 backdrop-blur">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wine font-bold text-white">{i + 1}</span>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-mute">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Perguntas frequentes" className="card bg-panel/80 p-5 backdrop-blur">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl font-bold">Perguntas frequentes</h2>
        <div className="divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="py-3">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-mute">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">Pronto para entrar?</h2>
        <p className="mt-2 text-mute">{offer.left > 0 ? `Ainda dá tempo: restam ${offer.left} vagas com bônus de boas-vindas.` : "Leva um minuto e é grátis."}</p>
        <Link href="/cadastro" className="btn-gold mt-4 inline-block px-8 py-3 text-base">Criar conta grátis</Link>
      </section>
    </div>
  );
}
