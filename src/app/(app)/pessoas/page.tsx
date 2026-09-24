import Link from "next/link";
import type { Prisma, ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { PROFILE_TYPES, UFS } from "@/lib/config";
import { isVerified, requireUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";

export const metadata = { title: "Pessoas" };

export default async function Pessoas({ searchParams }: { searchParams: Promise<{ tipo?: string; uf?: string; q?: string; on?: string; ver?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const blocked = await blockedIds(viewer.id);
  const where: Prisma.UserWhereInput = { status: "ACTIVE", id: { notIn: [...blocked, viewer.id] } };
  if (sp.tipo && sp.tipo in PROFILE_TYPES) where.profileType = sp.tipo as ProfileType;
  if (sp.tipo === "CASAIS") where.profileType = { in: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] };
  if (sp.uf) where.state = sp.uf;
  if (sp.q) where.OR = [{ nick: { contains: sp.q } }, { city: { contains: sp.q } }];
  if (sp.on) where.lastSeenAt = { gt: new Date(Date.now() - 5 * 60_000) };
  if (sp.ver) where.ageVerification = "APPROVED";
  if (!isVerified(viewer)) where.hideFromUnverified = false;

  const users = await db.user.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: 60, select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true, lastSeenAt: true } });
  const styles = await stylesFor(users.map((u) => u.id));
  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Pessoas</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Nick ou cidade" className="input min-w-40 flex-1" />
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="input w-auto">
          <option value="">Todos</option>
          <option value="CASAIS">Casais</option>
          {Object.entries(PROFILE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="uf" defaultValue={sp.uf ?? ""} className="input w-auto"><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="on" defaultChecked={!!sp.on} /> online</label>
        <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="ver" defaultChecked={!!sp.ver} /> verificados</label>
        <button className="btn-wine">Buscar</button>
      </form>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {users.map((u) => {
          const online = u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60_000;
          return (
            <Link key={u.id} href={`/u/${u.nick}`} className="card flex flex-col items-center p-4 text-center transition hover:border-gold/50">
              <div className="relative">
                <Avatar mediaId={u.avatarId} nick={u.nick} size={72} style={styles[u.id]} />
                {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-panel bg-green-500" />}
              </div>
              <div className="mt-2 max-w-full truncate text-sm"><Nick nick={u.nick} style={styles[u.id]} link={false} />{u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
              <div className="text-xs text-mute">{PROFILE_TYPES[u.profileType].label}</div>
              <div className="text-xs text-mute">{!u.hideCity && u.city ? `${u.city}/` : ""}{u.state}</div>
            </Link>
          );
        })}
      </div>
      {users.length === 0 && <p className="text-mute">Ninguém encontrado com esses filtros.</p>}
    </div>
  );
}
