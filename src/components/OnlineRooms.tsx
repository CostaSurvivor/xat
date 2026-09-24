import Link from "next/link";
import { db } from "@/lib/db";
import { roomIsActive, roomOnlineCounts } from "@/server/rooms";

export async function OnlineRooms() {
  const counts = await roomOnlineCounts();
  const rooms = (await db.room.findMany({ where: { OR: [{ isOfficial: true }, { id: { in: [...counts.keys()] } }] }, include: { owner: { select: { role: true, vipUntil: true, status: true } } }, take: 30 })).filter(roomIsActive);
  rooms.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || Number(b.isOfficial) - Number(a.isOfficial));
  return (
    <div className="card sticky top-20 p-4">
      <h3 className="mb-2 font-semibold text-gold">Salas agora</h3>
      <ul className="space-y-1">
        {rooms.slice(0, 10).map((r) => (
          <li key={r.id}>
            <Link href={`/${r.slug}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
              <span className="truncate">{r.isOfficial && "⭐ "}{r.name}</span>
              <span className="text-xs text-mute">{counts.get(r.id) ?? 0} on</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/salas" className="mt-2 block text-center text-xs text-mute underline">Ver todas</Link>
    </div>
  );
}
