import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { UFS } from "@/lib/config";
import { isSubscriber, requireUser } from "@/server/auth";
import { roomIsActive, roomOnlineCounts } from "@/server/rooms";

export const metadata = { title: "Salas" };

const ACCESS_LABEL: Record<string, string> = { PUBLIC: "", VERIFIED_ONLY: "✔ verificados", COUPLES_ONLY: "💑 casais", MEMBERS_ONLY: "🔒 membros" };

export default async function Salas({ searchParams }: { searchParams: Promise<{ q?: string; uf?: string; ordem?: string }> }) {
  const user = await requireUser();
  const canCreate = user.role === "ADMIN" || isSubscriber(user);
  const { q = "", uf = "", ordem = "online" } = await searchParams;
  const where: Prisma.RoomWhereInput = {};
  if (q) where.OR = [{ name: { contains: q } }, { slug: { contains: q.toLowerCase() } }, { description: { contains: q } }, { city: { contains: q } }];
  if (uf) where.state = uf;
  const [rooms, counts] = await Promise.all([
    db.room.findMany({ where, include: { _count: { select: { members: true } }, owner: { select: { id: true, nick: true, role: true, vipUntil: true, status: true } } }, take: 200 }),
    roomOnlineCounts(),
  ]);
  rooms.sort((a, b) => {
    if (ordem === "populares") return b._count.members - a._count.members;
    if (ordem === "novas") return b.createdAt.getTime() - a.createdAt.getTime();
    return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || Number(b.isOfficial) - Number(a.isOfficial) || b._count.members - a._count.members;
  });
  const visible = rooms.filter((r) => roomIsActive(r) || r.owner?.id === user.id || user.role !== "USER");
  const official = visible.filter((r) => r.isOfficial);
  const community = visible.filter((r) => !r.isOfficial);

  const Card = ({ r }: { r: (typeof rooms)[number] }) => (
    <Link href={`/${r.slug}`} className="card block p-4 transition hover:border-gold/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{r.isOfficial && "⭐ "}{r.name}{!roomIsActive(r) && <span className="ml-1 rounded bg-wine px-1 text-[10px]">inativa</span>}</h3>
          <p className="text-xs text-mute">/{r.slug}{r.city ? ` · ${r.city}/${r.state}` : r.state ? ` · ${r.state}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${counts.get(r.id) ? "bg-green-900/50 text-green-300" : "bg-panel2 text-mute"}`}>{counts.get(r.id) ?? 0} on</span>
      </div>
      {r.description && <p className="mt-2 line-clamp-2 text-sm text-mute">{r.description}</p>}
      <p className="mt-2 text-[11px] text-mute">{r._count.members} {r._count.members === 1 ? "membro" : "membros"} {ACCESS_LABEL[r.access] && `· ${ACCESS_LABEL[r.access]}`}{r.owner && ` · por @${r.owner.nick}`}</p>
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">Salas</h1>
        {canCreate ? <Link href="/salas/nova" className="btn-gold">+ Criar sala</Link> : <Link href="/assinar" className="btn-ghost">⭐ Assine e crie sua sala</Link>}
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, cidade, tema…" className="input min-w-48 flex-1" />
        <select name="uf" defaultValue={uf} className="input w-auto"><option value="">Todo o Brasil</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        <select name="ordem" defaultValue={ordem} className="input w-auto">
          <option value="online">Online agora</option>
          <option value="populares">Mais populares</option>
          <option value="novas">Mais novas</option>
        </select>
        <button className="btn-wine">Filtrar</button>
      </form>
      {official.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold">Oficiais</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{official.map((r) => <Card key={r.id} r={r} />)}</div>
        </section>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold">Da comunidade</h2>
        {community.length === 0 ? <p className="text-sm text-mute">Nenhuma sala encontrada.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{community.map((r) => <Card key={r.id} r={r} />)}</div>}
      </section>
    </div>
  );
}
