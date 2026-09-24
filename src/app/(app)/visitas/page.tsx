import Link from "next/link";
import { PROFILE_TYPES } from "@/lib/config";
import { VISITS } from "@/lib/visits";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { isSubscriber, requireUser } from "@/server/auth";
import { visitCountSince, visitsFor } from "@/server/visits";

export const metadata = { title: "Visitas" };
export const dynamic = "force-dynamic";

/** "Quem visitou meu perfil": contagem para todos, a lista de quem visitou é benefício de assinante. */
export default async function Visitas() {
  const user = await requireUser();
  const vip = isSubscriber(user);
  const [list, week] = await Promise.all([visitsFor(user.id), visitCountSince(user.id, 7)]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">👀 Quem visitou seu perfil</h1>
        <p className="text-sm text-mute">
          {list.length} {list.length === 1 ? "pessoa visitou" : "pessoas visitaram"} nos últimos {VISITS.windowDays} dias · {week} nos últimos 7 dias
        </p>
      </div>
      {!vip && list.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 border-wine/30 bg-pink-50 p-4">
          <p className="flex-1 text-sm">Veja <b>quem</b> passou pelo seu perfil e puxe papo. Exclusivo para assinantes.</p>
          <Link href="/assinar" className="btn-gold">⭐ Assinar e ver</Link>
        </div>
      )}
      {list.length === 0 ? (
        <p className="card p-8 text-center text-mute">Ninguém visitou seu perfil nos últimos {VISITS.windowDays} dias. Poste uma foto ou entre numa sala para aparecer mais! 🔥</p>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((v, i) =>
            vip ? (
              <Link key={v.id} href={`/u/${encodeURIComponent(v.nick)}`} className="flex items-center gap-3 p-3 hover:bg-black/5">
                <Avatar mediaId={v.avatarId} nick={v.nick} size={44} style={v.style} />
                <div className="min-w-0 flex-1">
                  <Nick nick={v.nick} style={v.style} link={false} />
                  <p className="truncate text-xs text-mute">
                    {PROFILE_TYPES[v.profileType as keyof typeof PROFILE_TYPES]?.label}
                    {!v.hideCity && v.city ? ` · ${v.city}/${v.state}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-mute">
                  <p>{timeAgo(v.lastAt)}</p>
                  {v.count > 1 && <p className="font-semibold text-wine">{v.count} visitas</p>}
                </div>
              </Link>
            ) : (
              <div key={i} className="flex items-center gap-3 p-3" aria-hidden>
                <span className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-pink-200 to-wine/40 blur-[2px]" />
                <div className="flex-1 space-y-1.5">
                  <span className="block h-3 w-32 rounded bg-panel2" />
                  <span className="block h-2.5 w-20 rounded bg-panel2" />
                </div>
                <span className="text-xs text-mute">{timeAgo(v.lastAt)}</span>
              </div>
            ),
          )}
        </div>
      )}
      <p className="text-center text-xs text-mute">Quer visitar sem deixar rastro? O poder 👻 Invisível da loja também esconde suas visitas.</p>
    </div>
  );
}
