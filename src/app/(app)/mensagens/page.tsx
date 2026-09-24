import Link from "next/link";
import { requireUser } from "@/server/auth";
import { inbox } from "@/server/pm";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";

export const metadata = { title: "Mensagens" };
export const dynamic = "force-dynamic";

export default async function Mensagens() {
  const user = await requireUser();
  const list = await inbox(user);
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Mensagens privadas</h1>
      {list.length === 0 && <p className="card p-6 text-center text-sm text-mute">Nenhuma conversa ainda. Encontre gente em <Link href="/pessoas" className="text-gold underline">Pessoas</Link> ou nas <Link href="/salas" className="text-gold underline">Salas</Link>.</p>}
      <ul className="card divide-y divide-line">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`/mensagens/${c.other.nick}`} className={`flex items-center gap-3 p-3 hover:bg-white/5 ${c.unread && c.priority ? "bg-gold/10" : ""}`}>
              <Avatar mediaId={c.other.avatarId} nick={c.other.nick} size={44} style={c.other.style} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><Nick nick={c.other.nick} style={c.other.style} link={false} />{c.priority && c.unread && <span className="text-xs text-gold">⚡ prioritário</span>}</div>
                <p className={`truncate text-sm ${c.unread ? "font-semibold text-white" : "text-mute"}`}>{c.last}</p>
              </div>
              <div className="text-right text-xs text-mute">{timeAgo(c.lastAt)}{c.unread && <div className="ml-auto mt-1 h-2.5 w-2.5 rounded-full bg-wine2" />}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
