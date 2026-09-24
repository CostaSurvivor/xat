import { notFound } from "next/navigation";
import Link from "next/link";
import { LIVE, iceServers } from "@/lib/live";
import { LiveRoom } from "@/components/LiveRoom";
import { requireUser } from "@/server/auth";
import { liveById, watchDenied } from "@/server/live";
import { stylesFor } from "@/server/styles";

export const metadata = { title: "Ao vivo" };
export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const live = await liveById((await params).id);
  if (!live) notFound();
  const denied = await watchDenied(user, live);
  if (denied)
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-semibold">{denied}</p>
        {live.audience === "VIP" ? <Link href="/assinar" className="btn-gold mt-4">💎 Assinar</Link> : <Link href="/ao-vivo" className="btn-gold mt-4">Outras transmissões</Link>}
      </div>
    );
  const style = (await stylesFor([live.hostId]))[live.hostId];
  return (
    <LiveRoom
      live={{
        id: live.id,
        title: live.title,
        hostId: live.hostId,
        hostNick: live.host.nick,
        hostAvatarId: live.host.avatarId,
        hostStyle: style,
        startedAt: live.startedAt.toISOString(),
        audience: live.audience,
        status: live.status,
      }}
      me={{ id: user.id, nick: user.nick }}
      ice={iceServers()}
      maxViewers={LIVE.maxViewers}
      presets={LIVE.tipPresets}
    />
  );
}
