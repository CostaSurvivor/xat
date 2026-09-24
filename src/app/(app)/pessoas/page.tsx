import Link from "next/link";
import type { Prisma, ProfileType } from "@prisma/client";
import { db } from "@/lib/db";
import { LIKE_GROUPS, LIKE_TAGS, PROFILE_TYPES, UFS } from "@/lib/config";
import { RADII, boundingBox, distanceLabel, distanceVisible, haversineKm } from "@/lib/geo";
import { isVerified, requireUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { LocationButton } from "@/components/LocationButton";

export const metadata = { title: "Pessoas" };
export const dynamic = "force-dynamic";

type SP = { tipo?: string; uf?: string; q?: string; on?: string; ver?: string; curte?: string; foto?: string; raio?: string };

export default async function Pessoas({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const me = viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : null;
  // padrão: 100 km quando sabemos onde a pessoa está; "br" = Brasil todo
  const raio = sp.raio === "br" || !me ? null : RADII.includes(Number(sp.raio) as (typeof RADII)[number]) ? Number(sp.raio) : 100;

  const blocked = await blockedIds(viewer.id);
  const where: Prisma.UserWhereInput = { status: "ACTIVE", id: { notIn: [...blocked, viewer.id] } };
  if (sp.tipo && sp.tipo in PROFILE_TYPES) where.profileType = sp.tipo as ProfileType;
  if (sp.tipo === "CASAIS") where.profileType = { in: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] };
  if (sp.uf) where.state = sp.uf;
  if (sp.q) where.OR = [{ nick: { contains: sp.q } }, { city: { contains: sp.q } }];
  if (sp.on) where.lastSeenAt = { gt: new Date(Date.now() - 5 * 60_000) };
  if (sp.ver) where.ageVerification = "APPROVED";
  if (sp.foto) where.avatarId = { not: null };
  if (sp.curte && LIKE_TAGS.includes(sp.curte)) where.likes = { array_contains: [sp.curte] };
  if (!isVerified(viewer)) where.hideFromUnverified = false;
  if (raio && me) {
    // busca por raio: só quem permite aparecer por distância
    const b = boundingBox(me, raio);
    Object.assign(where, { showDistance: true, hideCity: false, lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } });
  }

  const select = { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true, lastSeenAt: true, lat: true, lng: true, showDistance: true } as const;
  const rows = await db.user.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: raio ? 600 : 60, select });
  const withDist = rows.map((u) => ({ ...u, km: me && distanceVisible(u) ? haversineKm(me, { lat: u.lat!, lng: u.lng! }) : null }));
  const users = raio
    ? withDist.filter((u) => u.km != null && u.km <= raio).sort((a, b) => a.km! - b.km! || (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0)).slice(0, 60)
    : withDist;
  const styles = await stylesFor(users.map((u) => u.id));
  const confirmed = await import("@/server/testimonials").then((m) => m.confirmedIds(users.map((u) => u.id)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">{raio ? "📍 Perto de você" : "Pessoas"}</h1>
        <LocationButton source={viewer.geoSource} city={viewer.city} />
      </div>
      <form className="flex flex-wrap gap-2">
        <select name="raio" defaultValue={raio ? String(raio) : "br"} className="input w-auto" disabled={!me} title={me ? "" : "Informe sua cidade no perfil"}>
          {RADII.map((r) => <option key={r} value={r}>até {r} km</option>)}
          <option value="br">Brasil todo</option>
        </select>
        <input name="q" defaultValue={sp.q} placeholder="Nick ou cidade" className="input min-w-40 flex-1" />
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="input w-auto">
          <option value="">Todos</option>
          <option value="CASAIS">Casais</option>
          {Object.entries(PROFILE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="uf" defaultValue={sp.uf ?? ""} className="input w-auto"><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        <select name="curte" defaultValue={sp.curte ?? ""} className="input w-auto max-w-56">
          <option value="">Curte…</option>
          {LIKE_GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>{g.tags.map((t) => <option key={t}>{t}</option>)}</optgroup>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="on" defaultChecked={!!sp.on} /> online</label>
        <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="ver" defaultChecked={!!sp.ver} /> verificados</label>
        <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="foto" defaultChecked={!!sp.foto} /> com foto</label>
        <button className="btn-wine">Buscar</button>
      </form>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {users.map((u) => {
          const online = u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60_000;
          return (
            <Link key={u.id} href={`/u/${u.nick}`} className="card flex min-w-0 flex-col items-center p-4 text-center transition hover:border-wine/50">
              <div className="relative">
                <Avatar mediaId={u.avatarId} nick={u.nick} size={72} style={styles[u.id]} />
                {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-panel bg-green-500" />}
              </div>
              <div className="mt-2 max-w-full truncate text-sm"><Nick nick={u.nick} style={styles[u.id]} link={false} />{u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
              {confirmed.has(u.id) && <div title="Confirmado por quem conheceu pessoalmente" className="mt-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">🤝 Confirmado</div>}
              <div className="text-xs text-mute">{PROFILE_TYPES[u.profileType].label}</div>
              <div className="max-w-full truncate text-xs text-mute">{!u.hideCity && u.city ? `${u.city}/` : ""}{u.state}</div>
              {u.km != null && <div className="mt-1 rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-semibold text-wine">📍 {distanceLabel(u.km)}</div>}
            </Link>
          );
        })}
      </div>
      {users.length === 0 && (
        <p className="card p-6 text-center text-mute">
          Ninguém encontrado com esses filtros{raio ? ` em até ${raio} km` : ""}.{raio && raio < 300 && <> <Link href={`/pessoas?raio=${raio === 100 ? 300 : 100}`} className="text-wine underline">Aumentar o raio</Link></>}
        </p>
      )}
    </div>
  );
}
