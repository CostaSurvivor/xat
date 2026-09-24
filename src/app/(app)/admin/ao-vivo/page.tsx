import Link from "next/link";
import { db } from "@/lib/db";
import { CURRENCY_ICON } from "@/lib/config";
import { fmtDuration } from "@/lib/live";
import { adminEndLive } from "@/app/actions/live";
import { requireStaff } from "@/server/auth";
import { liveList } from "@/server/live";

export const dynamic = "force-dynamic";

export default async function AdminLive() {
  await requireStaff();
  const [lives, recent] = await Promise.all([
    liveList(),
    db.liveStream.findMany({ where: { status: "ENDED" }, orderBy: { endedAt: "desc" }, take: 30, include: { host: { select: { nick: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">No ar agora ({lives.length})</h2>
        {lives.length === 0 && <p className="text-sm text-mute">Nenhuma transmissão no ar.</p>}
        <div className="space-y-2">
          {lives.map((l) => (
            <div key={l.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/ao-vivo/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                <p className="text-xs text-mute">@{l.host.nick} · {fmtDuration(Date.now() - l.startedAt.getTime())} · 👁 {l.viewers} · {CURRENCY_ICON} {l.tipTotal} · {l.audience === "VIP" ? "só assinantes" : "todos"}</p>
              </div>
              <Link href={`/ao-vivo/${l.id}`} className="btn-ghost">Assistir</Link>
              <form action={async (fd) => { "use server"; await adminEndLive(l.id, String(fd.get("reason") ?? "")); }} className="flex gap-1">
                <input name="reason" placeholder="Motivo (opcional)" maxLength={80} className="input w-40 py-1 text-xs" />
                <button className="btn-wine">Encerrar</button>
              </form>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Encerradas recentemente</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-mute"><tr><th className="py-1">Quem</th><th>Título</th><th>Duração</th><th>Pico</th><th>Gorjetas</th><th>Motivo</th></tr></thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="py-1.5"><Link href={`/admin/usuarios/${l.hostId}`} className="hover:underline">@{l.host.nick}</Link></td>
                <td className="max-w-40 truncate">{l.title}</td>
                <td>{l.endedAt ? fmtDuration(l.endedAt.getTime() - l.startedAt.getTime()) : "—"}</td>
                <td>{l.peakViewers}</td>
                <td>{l.tipTotal}</td>
                <td className="max-w-48 truncate text-xs text-mute">{l.endReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
