import Link from "next/link";
import { db } from "@/lib/db";
import { canSeeGroup } from "@/lib/groups";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Grupos" };
export const dynamic = "force-dynamic";

export default async function Grupos() {
  const user = await requireUser();
  const since = new Date(Date.now() - 7 * 86400_000);
  const [groups, mine, activity] = await Promise.all([
    db.group.findMany({ where: { archivedAt: null }, include: { _count: { select: { members: true } } } }),
    db.groupMember.findMany({ where: { userId: user.id }, select: { groupId: true } }),
    db.post.groupBy({ by: ["groupId"], where: { groupId: { not: null }, deletedAt: null, createdAt: { gt: since } }, _count: true }),
  ]);
  const mineSet = new Set(mine.map((m) => m.groupId));
  const weekPosts = new Map(activity.map((a) => [a.groupId!, a._count]));
  const visible = groups
    .filter((g) => canSeeGroup(g, user))
    .sort((a, b) => Number(mineSet.has(b.id)) - Number(mineSet.has(a.id)) || (weekPosts.get(b.id) ?? 0) - (weekPosts.get(a.id) ?? 0) || b._count.members - a._count.members);
  const hiddenCouples = groups.some((g) => !canSeeGroup(g, user));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">💬 Grupos</h1>
        <p className="text-sm text-mute">Comunidades por interesse. Participe para postar; os posts ficam dentro de cada grupo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => (
          <Link key={g.id} href={`/grupos/${g.slug}`} className={`card flex min-w-0 flex-col gap-2 p-4 transition hover:border-wine/50 ${mineSet.has(g.id) ? "border-wine/40" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-2xl">{g.emoji}</span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{g.name}</h2>
                <p className="text-xs text-mute">
                  {g._count.members} {g._count.members === 1 ? "membro" : "membros"}
                  {weekPosts.get(g.id) ? ` · ${weekPosts.get(g.id)} posts na semana` : ""}
                  {g.audience === "COUPLES" && " · 💑 só casais"}
                </p>
              </div>
            </div>
            <p className="line-clamp-2 text-sm text-mute">{g.description}</p>
            {mineSet.has(g.id) && <span className="self-start rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold text-wine">✓ Você participa</span>}
          </Link>
        ))}
      </div>
      {hiddenCouples && <p className="text-center text-xs text-mute">Alguns grupos são exclusivos para perfis de casal.</p>}
      <p className="text-center text-xs text-mute">Tem ideia de grupo? Sugira em <Link href="/suporte" className="underline">Suporte</Link>.</p>
    </div>
  );
}
