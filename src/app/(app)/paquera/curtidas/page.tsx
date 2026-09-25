import Link from "next/link";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES, agesLabel } from "@/lib/config";
import { timeAgo } from "@/lib/time";
import { isSubscriber, requireUser } from "@/server/auth";
import { likesReceived } from "@/server/paquera";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { PaqueraTabs } from "@/components/PaqueraTabs";

export const metadata = { title: "Quem curtiu" };
export const dynamic = "force-dynamic";

/** Quem curtiu: contagem para todos; ver quem foi é benefício de assinante (matches aparecem sempre). */
export default async function Curtidas() {
  const user = await requireUser();
  const vip = isSubscriber(user);
  const list = await likesReceived(user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PaqueraTabs active="curtidas" likes={list.length} />
      <p className="text-sm text-mute">{list.length} {list.length === 1 ? "perfil curtiu" : "perfis curtiram"} vocês.</p>
      {!vip && list.some((l) => !l.match) && (
        <div className="card flex flex-wrap items-center gap-3 border-wine/30 bg-pink-50 p-4">
          <p className="flex-1 text-sm">Veja <b>quem</b> curtiu vocês e curta de volta para dar match. Exclusivo para assinantes. Sem assinar, curtam na Paquera: se for recíproco, o match aparece na hora.</p>
          <Link href="/assinar" className="btn-gold">⭐ Assinar e ver</Link>
        </div>
      )}
      {list.length === 0 ? (
        <p className="card p-8 text-center text-mute">Ainda ninguém curtiu. Capriche na foto e na bio e use a Paquera! 💘</p>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((u, i) =>
            vip || u.match ? (
              <Link key={u.id} href={`/u/${encodeURIComponent(u.nick)}`} className="flex items-center gap-3 p-3 hover:bg-black/5">
                <Avatar mediaId={u.avatarId} nick={u.nick} size={44} style={u.style} />
                <div className="min-w-0 flex-1">
                  <Nick nick={u.nick} style={u.style} link={false} />
                  <p className="truncate text-xs text-mute">{PROFILE_TYPES[u.profileType].label} · {agesLabel(u.persons.map((p) => ({ label: p.label, age: ageOn(p.birthDate) })))}</p>
                </div>
                <span className="shrink-0 text-xs text-mute">{u.match ? <b className="text-wine">💘 match</b> : timeAgo(u.at)}</span>
              </Link>
            ) : (
              <div key={i} className="flex items-center gap-3 p-3" aria-hidden>
                <span className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-pink-200 to-wine/40 blur-[2px]" />
                <div className="flex-1 space-y-1.5"><span className="block h-3 w-32 rounded bg-panel2" /><span className="block h-2.5 w-20 rounded bg-panel2" /></div>
                <span className="text-xs text-mute">{timeAgo(u.at)}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
