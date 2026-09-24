import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
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
  if (!o || o.id === user.id) notFound();
  const conv = await findConversation(user.id, o.id);
  const initial = conv ? await pmMessages(conv.id, user.id) : [];
  if (conv) await markRead(conv.id, user.id);
  const [blockedReason, st] = await Promise.all([canMessage(user, o), stylesFor([o.id])]);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/mensagens" className="text-mute">←</Link>
        <Avatar mediaId={o.avatarId} nick={o.nick} size={36} style={st[o.id]} />
        <Nick nick={o.nick} style={st[o.id]} />
      </div>
      <PmThread nick={o.nick} initial={initial} canPhoto={canSendPhoto(user, o)} blockedReason={blockedReason} />
    </div>
  );
}
