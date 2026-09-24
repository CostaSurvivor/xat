import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isVerified, requireUser } from "@/server/auth";
import { storiesOf } from "@/server/stories";
import { StoryViewer } from "@/components/StoryViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stories" };

export default async function Stories({ params }: { params: Promise<{ nick: string }> }) {
  const viewer = await requireUser();
  const nick = decodeURIComponent((await params).nick);
  const author = await db.user.findFirst({ where: { nick, status: "ACTIVE" }, select: { id: true, nick: true, avatarId: true, hideFromUnverified: true } });
  if (!author) notFound();
  const owner = author.id === viewer.id;
  if (!owner && author.hideFromUnverified && !isVerified(viewer)) notFound();
  const list = await storiesOf(author.id, viewer);
  if (!list.length) notFound();
  return (
    <StoryViewer
      owner={owner}
      author={{ nick: author.nick, avatarId: author.avatarId }}
      stories={list.map((s) => ({ id: s.id, mediaId: s.mediaId, caption: s.caption, audience: s.audience, createdAt: s.createdAt.toISOString(), views: owner ? s._count.views : 0, seen: s.views.length > 0 }))}
    />
  );
}
