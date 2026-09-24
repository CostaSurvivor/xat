import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { deleteRoom, manageMember, updateRoom } from "@/app/actions/rooms";
import { requireUser } from "@/server/auth";
import { actorFor, roomBySlug } from "@/server/rooms";
import { RoomForm } from "@/components/RoomForm";
import { MemberManager } from "@/components/MemberManager";

export const metadata = { title: "Gerenciar sala" };

export default async function RoomConfig({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) notFound();
  const actor = await actorFor(user, room.id);
  if (!can(actor, "mute")) redirect(`/${slug}`);
  const isOwner = can(actor, "edit_room");
  const [words, staff, sanctions] = await Promise.all([
    db.roomBannedWord.findMany({ where: { roomId: room.id } }),
    db.roomMember.findMany({ where: { roomId: room.id, role: { in: ["OWNER", "MODERATOR"] } }, include: { user: { select: { nick: true } } } }),
    db.roomSanction.findMany({ where: { roomId: room.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const sanctionUsers = await db.user.findMany({ where: { id: { in: sanctions.map((s) => s.userId) } }, select: { id: true, nick: true } });
  const nickOf = new Map(sanctionUsers.map((u) => [u.id, u.nick]));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/${slug}`} className="text-sm text-mute">← voltar para a sala</Link>
      {isOwner && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-gold">Configurações</h2>
          <RoomForm action={updateRoom.bind(null, slug)} room={room} bannedWords={words.map((w) => w.word).join(", ")} />
        </section>
      )}
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold text-gold">Equipe e membros</h2>
        <ul className="text-sm">
          {staff.map((s) => <li key={s.userId}>{s.role === "OWNER" ? "★ Dono" : "◆ Moderador"}: @{s.user.nick}</li>)}
        </ul>
        <MemberManager action={manageMember.bind(null, slug)} isOwner={isOwner} />
      </section>
      <section className="card p-5">
        <h2 className="mb-2 font-semibold text-gold">Punições ativas</h2>
        {sanctions.length === 0 ? <p className="text-sm text-mute">Nenhuma.</p> : (
          <ul className="space-y-1 text-sm">
            {sanctions.map((s) => (
              <li key={s.id}>{s.type === "BAN" ? "🚫" : "🔇"} @{nickOf.get(s.userId)} · {s.expiresAt ? `até ${s.expiresAt.toLocaleString("pt-BR")}` : "permanente"}{s.reason ? ` · ${s.reason}` : ""}</li>
            ))}
          </ul>
        )}
      </section>
      {isOwner && !room.isOfficial && (
        <form action={deleteRoom.bind(null, slug)} className="text-right">
          <button className="text-sm text-red-300 underline">Excluir sala definitivamente</button>
        </form>
      )}
    </div>
  );
}
