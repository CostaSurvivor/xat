import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth";
import { adminRoomAction } from "@/app/actions/admin";
import { roomOnlineCounts } from "@/server/rooms";

export const dynamic = "force-dynamic";

export default async function AdminSalas() {
  await requireAdmin();
  const [rooms, counts] = await Promise.all([db.room.findMany({ include: { owner: { select: { nick: true } }, _count: { select: { members: true, messages: true } } }, orderBy: { createdAt: "desc" } }), roomOnlineCounts()]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Salas ({rooms.length})</h1>
      <div className="card divide-y divide-line">
        {rooms.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <Link href={`/${r.slug}`} className="font-semibold">{r.isOfficial && "⭐ "}/{r.slug}</Link>
            <span>{r.name}</span>
            <span className="text-xs text-mute">{r.owner ? `@${r.owner.nick}` : "plataforma"} · {r._count.members} membros · {r._count.messages} msgs · {counts.get(r.id) ?? 0} on</span>
            <div className="ml-auto flex gap-1">
              <form action={adminRoomAction.bind(null, r.id)}><input type="hidden" name="op" value="official" /><button className="btn-ghost py-1 text-xs">{r.isOfficial ? "Tirar oficial" : "Tornar oficial"}</button></form>
              <form action={adminRoomAction.bind(null, r.id)}><input type="hidden" name="op" value="delete" /><button className="btn-wine py-1 text-xs">Excluir</button></form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
