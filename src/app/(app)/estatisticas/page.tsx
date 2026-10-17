import Link from "next/link";
import { requireUser } from "@/server/auth";
import { statsFor } from "@/server/stats";
import { ColumnChart } from "@/components/ReportCharts";

export const metadata = { title: "Estatísticas" };
export const dynamic = "force-dynamic";

const ICON = { visits: "👀", reactions: "🔥", comments: "💬" } as const;

export default async function Estatisticas() {
  const user = await requireUser();
  const stats = await statsFor(user.id);
  const visits = stats[0];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/u/${encodeURIComponent(user.nick)}`} className="text-sm text-mute hover:text-fg">← Meu perfil</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">📊 Estatísticas do perfil</h1>
      <p className="text-sm text-mute">Só você vê. Visitas contam uma vez por pessoa a cada algumas horas; reações e comentários são os recebidos nos seus posts.</p>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="stat-cards">
        {stats.map((s) => (
          <section key={s.field} className="card p-4" aria-label={s.label} data-testid={`stat-${s.field}`}>
            <h2 className="text-sm text-mute">{ICON[s.field]} {s.label}</h2>
            <p className="mt-1 text-3xl font-bold leading-none">{s.d7.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-mute">nos últimos 7 dias</p>
            {s.deltaPct != null && (
              <p className={`mt-1 text-xs font-semibold ${s.deltaPct >= 0 ? "text-emerald-700" : "text-red-700"}`} data-testid="delta">
                {s.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(s.deltaPct)}% <span className="font-normal text-mute">vs. 7 dias antes</span>
              </p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-1 border-t border-line pt-2 text-xs">
              <div><dt className="text-mute">Hoje</dt><dd className="font-semibold">{s.today}</dd></div>
              <div><dt className="text-mute">30 dias</dt><dd className="font-semibold">{s.d30}</dd></div>
            </dl>
          </section>
        ))}
      </div>

      <section className="card p-4" aria-label="Visitas por dia">
        <h2 className="mb-2 font-semibold">👀 Visitas por dia <span className="text-xs font-normal text-mute">(últimos 14 dias)</span></h2>
        {visits.d30 === 0 ? (
          <p className="text-sm text-mute">Ainda sem visitas registradas. Perfil completo, foto e posts trazem mais gente.</p>
        ) : (
          <>
            <ColumnChart data={visits.series.slice(-14)} kind="count" label="Visitas por dia nos últimos 14 dias" />
            <details className="mt-2 text-xs text-mute">
              <summary className="cursor-pointer">Ver em tabela</summary>
              <table className="mt-1 w-full">
                <tbody>
                  {visits.series.slice(-14).map((d) => <tr key={d.day} className="border-t border-line"><td className="py-0.5">{d.day.split("-").reverse().slice(0, 2).join("/")}</td><td className="text-right">{d.value}</td></tr>)}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      {visits.deltaPct != null && visits.deltaPct < 0 && (
        <p className="card p-4 text-sm">💡 Suas visitas caíram esta semana. Publicar uma foto nova, atualizar o “Sobre” ou ligar o 🔥 Afim hoje costuma trazer gente de volta.</p>
      )}
      <Link href="/visitas" className="btn-ghost w-full justify-center">Ver quem visitou →</Link>
    </div>
  );
}
