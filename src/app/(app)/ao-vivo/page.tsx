import Link from "next/link";
import { db } from "@/lib/db";
import { CURRENCY_ICON, CURRENCY_NAME, PROFILE_TYPES } from "@/lib/config";
import { fmtDuration } from "@/lib/live";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/server/auth";
import { canBroadcast, liveList } from "@/server/live";

export const metadata = { title: "Ao vivo" };
export const dynamic = "force-dynamic";

export default async function AoVivo() {
  const user = await requireUser();
  const [lives, mine] = await Promise.all([
    liveList(),
    db.liveStream.findFirst({ where: { hostId: user.id, status: "LIVE" }, select: { id: true } }),
  ]);
  const denied = canBroadcast(user);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold"><span className="live-dot text-red-500">●</span> Ao vivo</h1>
        {mine ? (
          <Link href={`/ao-vivo/${mine.id}`} className="btn-wine">Voltar para sua transmissão</Link>
        ) : denied ? (
          <Link href={denied.href} className="btn-ghost" title={denied.message}>{denied.cta}</Link>
        ) : (
          <Link href="/ao-vivo/nova" className="btn-gold">🎥 Transmitir agora</Link>
        )}
      </div>
      <p className="text-sm text-mute">Transmissões ao vivo da comunidade. Converse no chat e apoie com gorjetas em {CURRENCY_NAME}. Gravar, printar ou divulgar é proibido e dá banimento.</p>
      {lives.length === 0 ? (
        <div className="card p-8 text-center text-mute">
          <p className="text-4xl">📡</p>
          <p className="mt-2">Ninguém ao vivo agora.</p>
          {!denied && !mine && <Link href="/ao-vivo/nova" className="btn-gold mt-4">Seja o primeiro</Link>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lives.map((l) => (
            <Link key={l.id} href={`/ao-vivo/${l.id}`} className="card group overflow-hidden transition hover:border-gold/50">
              <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-wine/60 via-ink to-black">
                <Avatar mediaId={l.host.avatarId} nick={l.host.nick} size={72} />
                <span className="live-dot absolute left-2 top-2 rounded bg-red-600 text-white px-2 py-0.5 text-xs font-bold">● AO VIVO</span>
                <span className="absolute right-2 top-2 rounded bg-black/60 text-white px-2 py-0.5 text-xs">👁 {l.viewers}</span>
                {l.audience === "VIP" && <span className="absolute bottom-2 left-2 rounded bg-fuchsia-700/80 text-white px-2 py-0.5 text-xs">💎 assinantes</span>}
                <span className="absolute bottom-2 right-2 rounded bg-black/60 text-white px-2 py-0.5 text-xs">{fmtDuration(Date.now() - l.startedAt.getTime())}</span>
              </div>
              <div className="p-3">
                <h3 className="truncate font-semibold group-hover:text-gold2">{l.title}</h3>
                <p className="truncate text-xs text-mute">
                  @{l.host.nick} · {PROFILE_TYPES[l.host.profileType as keyof typeof PROFILE_TYPES]?.label ?? ""}
                  {!l.host.hideCity && l.host.city ? ` · ${l.host.city}/${l.host.state}` : ""}
                  {l.tipTotal > 0 && ` · ${CURRENCY_ICON} ${l.tipTotal}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
