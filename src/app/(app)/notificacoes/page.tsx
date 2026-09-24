import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

export default async function Notificacoes() {
  const user = await requireUser();
  const list = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 });
  const actors = await db.user.findMany({ where: { id: { in: list.map((n) => n.actorId).filter(Boolean) as string[] } }, select: { id: true, nick: true } });
  const nickOf = new Map(actors.map((a) => [a.id, a.nick]));
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  const href = (n: (typeof list)[number]) => {
    if (n.kind === "POST_REACTION" || n.kind === "POST_COMMENT" || n.kind === "FOLLOW") return n.actorId ? `/u/${nickOf.get(n.actorId)}` : "#";
    if (n.kind === "ALBUM_REQUEST") return "/perfil";
    if (n.kind === "COINS_CREDITED") return "/carteira";
    if (n.kind === "GIFT") return "/loja/inventario";
    if (n.kind === "VERIFICATION") return "/verificacao";
    return n.actorId ? `/u/${nickOf.get(n.actorId)}` : "#";
  };
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Avisos</h1>
      {list.length === 0 && <p className="card p-6 text-center text-mute">Nada por aqui ainda.</p>}
      <ul className="card divide-y divide-line">
        {list.map((n) => (
          <li key={n.id}>
            <Link href={href(n)} className={`flex gap-3 p-3 text-sm hover:bg-white/5 ${!n.readAt ? "bg-wine/15" : ""}`}>
              <span className="flex-1">{n.text}</span>
              <span className="text-xs text-mute">{timeAgo(n.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
