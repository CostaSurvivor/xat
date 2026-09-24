import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth";
import { createAnnouncement, endAnnouncement } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Avisos() {
  await requireAdmin();
  const list = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const now = new Date();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Anúncios globais</h1>
      <form action={createAnnouncement} className="card space-y-2 p-4">
        <textarea name="body" required maxLength={500} placeholder="Mensagem para todo mundo…" className="input h-20" />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Duração (h) <input name="hours" type="number" defaultValue={24} className="input ml-1 inline w-20 py-1" /></label>
          <label className="flex items-center gap-1"><input type="checkbox" name="rooms" defaultChecked /> também postar em todas as salas</label>
          <button className="btn-gold ml-auto">Publicar</button>
        </div>
      </form>
      <ul className="card divide-y divide-line text-sm">
        {list.map((a) => {
          const live = !a.expiresAt || a.expiresAt > now;
          return (
            <li key={a.id} className="flex items-center gap-2 p-3">
              <span className="flex-1">{a.body}</span>
              <span className="text-xs text-mute">{live ? "no ar" : "encerrado"}</span>
              {live && <form action={endAnnouncement.bind(null, a.id)}><button className="btn-ghost py-1 text-xs">Encerrar</button></form>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
