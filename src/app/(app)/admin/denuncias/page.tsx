import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/server/auth";
import { handleReport } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

const REASON_PT: Record<string, string> = {
  POSSIBLE_MINOR: "🚨 POSSÍVEL MENOR", NON_CONSENSUAL: "Sem consentimento", ILLEGAL_CONTENT: "Conteúdo ilegal", HARASSMENT: "Assédio", FAKE_PROFILE: "Perfil falso", SPAM: "Spam", OTHER: "Outro",
};

export default async function Denuncias({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const { status = "OPEN" } = await searchParams;
  const reports = await db.report.findMany({
    where: { status: status as "OPEN" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 50,
    include: { reporter: { select: { nick: true } } },
  });
  const targets = await db.user.findMany({ where: { id: { in: reports.map((r) => r.targetUserId).filter(Boolean) as string[] } }, select: { id: true, nick: true } });
  const nickOf = new Map(targets.map((t) => [t.id, t.nick]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Denúncias</h1>
        {["OPEN", "ESCALATED", "RESOLVED", "DISMISSED"].map((s) => <Link key={s} href={`?status=${s}`} className={`rounded-full px-3 py-1 text-xs ${s === status ? "bg-wine" : "border border-line"}`}>{s}</Link>)}
      </div>
      <details className="card p-4 text-sm text-mute">
        <summary className="cursor-pointer font-semibold text-white">📋 Procedimento para possível abuso sexual infantil (CSAM)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Não baixe, não encaminhe e não compartilhe o conteúdo. Posse e distribuição são crimes (ECA, arts. 241-A e 241-B).</li>
          <li>Clique em <b>“Escalar”</b>: a mídia fica em quarentena, o hash entra na blocklist, a conta é banida e as evidências ficam preservadas.</li>
          <li>Registre a denúncia em <a className="text-gold underline" href="https://new.safernet.org.br/denuncie" target="_blank" rel="noreferrer">SaferNet (denuncie.org.br)</a> e/ou na Polícia Federal, informando o ID da denúncia, o nick, a data e hora e os IPs (registros de acesso).</li>
          <li>Guarde o protocolo recebido na nota da denúncia.</li>
        </ol>
      </details>
      {reports.length === 0 && <p className="text-mute">Nenhuma denúncia {status === "OPEN" ? "aberta" : "nesta lista"}.</p>}
      {reports.map((r) => (
        <div key={r.id} className={`card space-y-2 p-4 ${r.reason === "POSSIBLE_MINOR" ? "border-red-500/70" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <b className={r.reason === "POSSIBLE_MINOR" ? "text-red-300" : "text-gold"}>{REASON_PT[r.reason]}</b>
            <span className="text-mute">· {r.targetType} · alvo: {r.targetUserId ? <Link href={`/u/${nickOf.get(r.targetUserId)}`} className="underline">@{nickOf.get(r.targetUserId)}</Link> : "—"} · por @{r.reporter.nick} · {r.createdAt.toLocaleString("pt-BR")}</span>
            <span className="ml-auto font-mono text-xs text-mute">{r.id}</span>
          </div>
          {r.details && <p className="text-sm">“{r.details}”</p>}
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-2 text-xs text-mute">{JSON.stringify(r.evidence, null, 1)}</pre>
          {Array.isArray((r.evidence as { media?: string[] } | null)?.media) && (
            <div className="flex gap-2">
              {((r.evidence as { media: string[] }).media).map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={`/api/media/${id}?v=${r.reason === "POSSIBLE_MINOR" ? "b" : "d"}`} alt="" className="h-28 rounded bg-black object-contain" />
              ))}
            </div>
          )}
          {r.resolution && <p className="text-xs text-mute">Resolução: {r.resolution}</p>}
          {status === "OPEN" && (
            <form action={handleReport.bind(null, r.id)} className="flex flex-wrap gap-2">
              <input name="note" placeholder="Nota / protocolo" className="input w-56 py-1 text-xs" />
              <button name="op" value="dismiss" className="btn-ghost py-1 text-xs">Improcedente</button>
              <button name="op" value="remove" className="btn-ghost py-1 text-xs">Remover conteúdo</button>
              <button name="op" value="remove_suspend" className="btn-wine py-1 text-xs">Remover + suspender 7d</button>
              <button name="op" value="remove_ban" className="btn-wine py-1 text-xs">Remover + banir</button>
              <button name="op" value="escalate" className="btn rounded-full bg-red-700 py-1 text-xs text-white">🚨 Escalar (crime)</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
