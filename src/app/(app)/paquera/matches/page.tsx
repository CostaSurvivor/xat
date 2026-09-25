import Link from "next/link";
import { PROFILE_TYPES } from "@/lib/config";
import { timeAgo } from "@/lib/time";
import { requireUser } from "@/server/auth";
import { likesReceivedCount, matchesOf } from "@/server/paquera";
import { unlikeProfile } from "@/app/actions/paquera";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Nick } from "@/components/Nick";
import { PaqueraTabs } from "@/components/PaqueraTabs";

export const metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

export default async function Matches() {
  const user = await requireUser();
  const [list, likes] = await Promise.all([matchesOf(user.id), likesReceivedCount(user.id)]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PaqueraTabs active="matches" likes={likes} />
      {list.length === 0 ? (
        <p className="card p-8 text-center text-mute">Nenhum match ainda. Curta perfis na Paquera: quando for recíproco, aparece aqui. 💘</p>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3" data-match={u.nick}>
              <Link href={`/u/${encodeURIComponent(u.nick)}`}><Avatar mediaId={u.avatarId} nick={u.nick} size={48} style={u.style} /></Link>
              <div className="min-w-0 flex-1">
                <Nick nick={u.nick} style={u.style} />
                <p className="truncate text-xs text-mute">{PROFILE_TYPES[u.profileType].label} · match {timeAgo(u.at)}</p>
              </div>
              <Link href={`/mensagens/${encodeURIComponent(u.nick)}`} className="btn-gold py-1.5 text-sm">✉️ PV</Link>
              <form action={unlikeProfile.bind(null, u.id)}>
                <ConfirmButton message={`Desfazer o match com @${u.nick}?`} className="text-xs text-mute hover:text-red-700">desfazer</ConfirmButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
