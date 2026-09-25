import Link from "next/link";
import { brl, compact, parsePeriod, PERIODS, shortDay } from "@/lib/report";
import { requireAdmin } from "@/server/auth";
import { adminReport } from "@/server/report";
import { ColumnChart, HBars } from "@/components/ReportCharts";

export const metadata = { title: "Relatório" };
export const dynamic = "force-dynamic";

type K = { value: number; prev: number; delta: { pct: number | null; dir: "up" | "down" | "flat" } };

/** Stat tile: rótulo, valor, variação vs período anterior (cor = direção × se subir é bom). */
function Stat({ label, k, fmt = compact, upIsGood = true, days }: { label: string; k: K; fmt?: (n: number) => string; upIsGood?: boolean; days: number }) {
  const { dir, pct } = k.delta;
  const good = dir === "flat" ? null : (dir === "up") === upIsGood;
  return (
    <div className="card p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="text-2xl font-semibold text-fg">{fmt(k.value)}</p>
      <p className={`text-xs ${good === null ? "text-mute" : good ? "text-green-700" : "text-red-700"}`}>
        {dir === "up" ? "▲" : dir === "down" ? "▼" : "="} {pct === null ? "novo" : `${pct > 0 ? "+" : ""}${pct}%`} <span className="text-mute">vs {days} dias anteriores ({fmt(k.prev)})</span>
      </p>
    </div>
  );
}

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdmin(); // tem receita: só admin (igual à tela de Pix)
  const days = parsePeriod((await searchParams).p);
  const r = await adminReport(days);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">📈 Relatório</h1>
        {PERIODS.map((p) => (
          <Link key={p} href={`/admin/relatorio?p=${p}`} className={`rounded-full px-3 py-1 text-sm ${p === days ? "bg-wine2 text-white" : "border border-line text-mute"}`}>{p} dias</Link>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-x-8 gap-y-2 p-5">
        <div>
          <p className="text-xs text-mute">Receita nos últimos {days} dias</p>
          <p className="text-5xl font-semibold tracking-tight text-fg">{brl(r.kpis.revenueCents.value)}</p>
        </div>
        <p className={`pb-2 text-sm ${r.kpis.revenueCents.delta.dir === "down" ? "text-red-700" : r.kpis.revenueCents.delta.dir === "up" ? "text-green-700" : "text-mute"}`}>
          {r.kpis.revenueCents.delta.pct === null ? "▲ novo" : `${r.kpis.revenueCents.delta.dir === "up" ? "▲" : r.kpis.revenueCents.delta.dir === "down" ? "▼" : "="} ${r.kpis.revenueCents.delta.pct}%`} <span className="text-mute">vs {days} dias anteriores ({brl(r.kpis.revenueCents.prev)})</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Cadastros" k={r.kpis.signups} days={days} />
        <Stat label="Perfis verificados" k={r.kpis.verified} days={days} />
        <Stat label="Mensagens nas salas" k={r.kpis.messages} days={days} />
        <Stat label="Denúncias recebidas" k={r.kpis.reports} days={days} upIsGood={false} />
        <div className="card p-4">
          <p className="text-xs text-mute">Pessoas ativas no período</p>
          <p className="text-2xl font-semibold text-fg">{compact(r.kpis.activeNow)}</p>
          <p className="text-xs text-mute">entraram pelo menos 1 vez</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="font-semibold">Cadastros por dia</h2>
          <p className="mb-2 text-xs text-mute">Novos perfis criados, horário de Brasília</p>
          <ColumnChart data={r.series.signups} kind="count" label="Cadastros por dia" />
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Receita por dia</h2>
          <p className="mb-2 text-xs text-mute">Pagamentos aprovados (Pix conferido), em reais</p>
          <ColumnChart data={r.series.revenueCents} kind="money" label="Receita por dia" />
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Mensagens nas salas por dia</h2>
          <p className="mb-2 text-xs text-mute">Só mensagens de texto (sem avisos do sistema)</p>
          <ColumnChart data={r.series.messages} kind="count" label="Mensagens nas salas por dia" />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Salas mais movimentadas</h2>
          <HBars rows={r.topRooms} empty="Sem mensagens no período." />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Denúncias por motivo</h2>
          <HBars rows={r.reportsByReason} empty="Nenhuma denúncia no período. 🎉" />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Itens mais vendidos</h2>
          <HBars rows={r.topItems} empty="Sem vendas no período." />
        </section>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Ver os números dia a dia (tabela)</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-right tabular-nums">
            <thead className="sticky top-0 bg-panel text-xs text-mute">
              <tr><th className="text-left">Dia</th><th>Cadastros</th><th>Receita</th><th>Mensagens</th></tr>
            </thead>
            <tbody>
              {[...r.series.signups].reverse().map((d) => {
                const rev = r.series.revenueCents.find((x) => x.day === d.day)?.value ?? 0;
                const msg = r.series.messages.find((x) => x.day === d.day)?.value ?? 0;
                return (
                  <tr key={d.day} className="border-t border-line">
                    <td className="py-1 text-left">{shortDay(d.day)}</td><td>{d.value}</td><td>{brl(rev)}</td><td>{msg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
