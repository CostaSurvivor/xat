import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { joinRoom, leaveRoom } from "@/app/actions/rooms";
import { requireUser } from "@/server/auth";
import { actorFor, canEnter, messagesView, roomBySlug } from "@/server/rooms";
import { ChatRoom } from "@/components/ChatRoom";
import { ReportButton } from "@/components/ReportButton";

const THEMES: Record<string, string> = {
  noir: "from-ink to-ink",
  vinho: "from-[#2a0712] to-ink",
  ouro: "from-[#2a2107] to-ink",
  neon: "from-[#1a0730] to-ink",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const room = await roomBySlug((await params).slug);
  return { title: room?.name ?? "Sala" };
}

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const room = await roomBySlug(slug);
  if (!room) notFound();
  const actor = await actorFor(user, room.id);
  const denied = await canEnter(user, room, actor);
  const initial = denied ? [] : await messagesView(room.id, user.id, { take: 60 });
  const members = await db.roomMember.count({ where: { roomId: room.id } });

  return (
    <div className={`relative -mx-3 -my-4 bg-gradient-to-b px-3 py-3 sm:-mx-4 sm:px-4 ${THEMES[room.theme] ?? THEMES.noir}`}>
      {room.bgMediaId && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${room.bgMediaId}?v=d`} alt="" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/40 to-ink" />
        </div>
      )}
      <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-bold">{room.isOfficial && "⭐ "}{room.name}</h1>
          <p className="truncate text-xs text-mute">/{room.slug} · {members} {members === 1 ? "membro" : "membros"}{room.description ? ` · ${room.description}` : ""}</p>
        </div>
        {room.rules && (
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none text-xs">Regras</summary>
            <div className="card absolute right-0 z-20 mt-1 w-72 whitespace-pre-wrap p-3 text-xs text-mute">{room.rules}</div>
          </details>
        )}
        {actor.role === "GUEST" && room.access !== "MEMBERS_ONLY" && !denied && (
          <form action={joinRoom.bind(null, room.slug)}><button className="btn-wine text-xs">+ Virar membro</button></form>
        )}
        {(actor.role === "MEMBER" || actor.role === "MODERATOR") && (
          <form action={leaveRoom.bind(null, room.slug)}><button className="btn-ghost text-xs">Sair da sala</button></form>
        )}
        {(actor.role === "OWNER" || actor.role === "MODERATOR" || actor.platformRole !== "USER") && (
          <Link href={`/${room.slug}/config`} className="btn-ghost text-xs">⚙️ Gerenciar</Link>
        )}
        <ReportButton targetType="ROOM" targetId={room.id} label="" />
      </div>
      {denied ? (
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-lg">{denied}</p>
          {denied.includes("verificados") && <Link href="/verificacao" className="btn-gold mt-4">Verificar meu perfil</Link>}
          <Link href="/salas" className="btn-ghost mt-4 ml-2">Outras salas</Link>
        </div>
      ) : (
        <ChatRoom slug={room.slug} me={{ id: user.id, nick: user.nick }} initial={initial} />
      )}
      </div>
    </div>
  );
}
