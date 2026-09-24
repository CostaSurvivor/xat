import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PROFILE_TYPES } from "@/lib/config";
import { requireUser } from "@/server/auth";
import { canMessage, canSendPhoto, findConversation, markRead, pmMessages } from "@/server/pm";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { PmThread } from "@/components/PmThread";

export const dynamic = "force-dynamic";

export default async function Thread({ params }: { params: Promise<{ nick: string }> }) {
  const user = await requireUser();
  const nick = decodeURIComponent((await params).nick);
  const o = await db.user.findFirst({ where: { nick } });
  if (!o || o.id === user.id || o.status !== "ACTIVE") notFound();
  const conv = await findConversation(user.id, o.id);
  const initial = conv ? await pmMessages(conv.id, user.id) : [];
  if (conv) await markRead(conv.id, user.id);
  const [blockedReason, st] = await Promise.all([canMessage(user, o), stylesFor([o.id])]);
  const online = !!o.lastSeenAt && Date.now() - o.lastSeenAt.getTime() < 5 * 60_000;
  return (
    <section className="card flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line bg-panel2/60 px-3 py-2">
        <Link href="/mensagens" className="px-1 text-xl text-mute md:hidden" aria-label="Voltar">←</Link>
        <Avatar mediaId={o.avatarId} nick={o.nick} size={40} style={st[o.id]} />
        <div className="min-w-0 flex-1 leading-tight">
          <Nick nick={o.nick} style={st[o.id]} />
          <p className="text-xs text-mute">{online ? <span className="text-green-400">online</span> : PROFILE_TYPES[o.profileType].label}</p>
        </div>
        <Link href={`/u/${o.nick}`} className="btn-ghost py-1 text-xs">Ver perfil</Link>
      </header>
      <PmThread nick={o.nick} initial={initial} canPhoto={canSendPhoto(user, o)} blockedReason={blockedReason} />
    </section>
  );
}
