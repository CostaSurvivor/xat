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
import { visitors } from "@/server/trips";
import { TRIPS, todayBR } from "@/lib/trips";
import { affinity } from "@/lib/affinity";
import { searchOthers } from "@/server/search";
import { SearchOthers } from "@/components/SearchOthers";
import { AfimToggle } from "@/components/AfimToggle";
import { FiltersToggle } from "@/components/FiltersToggle";
import { AGE_MAX, AGE_MIN, birthBounds, lastSeenLabel, parseAgeRange, personsLine } from "@/lib/profileInfo";
import { SearchAlerts } from "@/components/SearchAlerts";
import { myAlerts } from "@/server/searchAlerts";
import { parseAlert } from "@/lib/searchAlerts";
import { afimUntilLabel, isAfim } from "@/lib/afim";

export const metadata = { title: "Pessoas" };
export const dynamic = "force-dynamic";

type SP = { ordem?: string; tipo?: string; uf?: string; q?: string; on?: string; ver?: string; curte?: string; foto?: string; raio?: string; afim?: string; idmin?: string; idmax?: string; vista?: string };

export default async function Pessoas({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const me = viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : null;
  // padrão: 100 km quando sabemos onde a pessoa está; "br" = Brasil todo
  // buscando por nick/cidade/tema sem raio escolhido: Brasil todo
  const raio = sp.raio === "br" || !me || (sp.q && !sp.raio) ? null : RADII.includes(Number(sp.raio) as (typeof RADII)[number]) ? Number(sp.raio) : 100;

  const blocked = await blockedIds(viewer.id);
  const where: Prisma.UserWhereInput = { status: "ACTIVE", id: { notIn: [...blocked, viewer.id] } };
  if (sp.tipo && sp.tipo in PROFILE_TYPES) where.profileType = sp.tipo as ProfileType;
  if (sp.tipo === "CASAIS") where.profileType = { in: ["COUPLE_MF", "COUPLE_MM", "COUPLE_FF"] };
  if (sp.uf) where.state = sp.uf;
  const qText = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  if (qText) where.OR = [{ nick: { contains: qText } }, { city: { contains: qText }, hideCity: false }];
  if (sp.on) where.lastSeenAt = { gt: new Date(Date.now() - 5 * 60_000) };
  if (sp.ver) where.ageVerification = "APPROVED";
  if (sp.foto) where.avatarId = { not: null };
  if (sp.afim) where.afimUntil = { gt: new Date() };
  if (sp.curte && LIKE_TAGS.includes(sp.curte)) where.likes = { array_contains: [sp.curte] };
  if (!isVerified(viewer)) where.hideFromUnverified = false;
  // faixa de idade: pelo menos uma pessoa do perfil dentro dela
  const ages = parseAgeRange(sp.idmin, sp.idmax);
  if (ages.min != null || ages.max != null) where.persons = { some: { birthDate: birthBounds(ages.min, ages.max) } };
  if (raio && me) {
    // busca por raio: só quem permite aparecer por distância
    const b = boundingBox(me, raio);
    Object.assign(where, { showDistance: true, hideCity: false, lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } });
  }

  const select = { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, ageVerification: true, lastSeenAt: true, lat: true, lng: true, showDistance: true, likes: true, afimUntil: true, afimNote: true, createdAt: true, persons: { select: { label: true, birthDate: true, orientation: true }, orderBy: { id: "asc" as const } } } as const;
  // ordem: "" (perto, se houver raio; senão online recente) · online · novos · afinidade
  const ordem = ["online", "novos", "afinidade"].includes(String(sp.ordem)) ? String(sp.ordem) : "";
  const rows = await db.user.findMany({ where, orderBy: ordem === "novos" ? { createdAt: "desc" } : { lastSeenAt: "desc" }, take: raio || ordem === "afinidade" ? 600 : 60, select });
  const withDist = rows.map((u) => ({ ...u, km: me && distanceVisible(u) ? haversineKm(me, { lat: u.lat!, lng: u.lng! }) : null }));
  const byAffinity = ordem === "afinidade";
  const scored = withDist.map((u) => ({ ...u, aff: affinity(viewer.likes, u.likes)?.pct ?? null }));
  const inRange = raio ? scored.filter((u) => u.km != null && u.km <= raio) : scored;
  // afinidade: maior primeiro (quem não dá para calcular vai para o fim); senão, distância / último acesso
  const users = byAffinity
    ? [...inRange].sort((a, b) => (b.aff ?? -1) - (a.aff ?? -1) || (a.km ?? 0) - (b.km ?? 0)).slice(0, 60)
    : raio && !ordem
      ? inRange.sort((a, b) => a.km! - b.km! || (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0)).slice(0, 60)
      : inRange.slice(0, 60);
  const activeFilters = [sp.tipo, sp.uf, sp.curte, sp.afim, sp.on, sp.ver, sp.foto, ages.min ?? ages.max].filter((v) => v != null && v !== "").length;
  const styles = await stylesFor(users.map((u) => u.id));
  // modo lista: as 3 fotos públicas mais recentes de cada perfil
  const lista = sp.vista === "lista";
  const lastPhotos = new Map<string, string[]>();
  if (lista && users.length) {
    const pm = await db.postMedia.findMany({
      where: { post: { authorId: { in: users.map((u) => u.id) }, deletedAt: null, visibility: "PUBLIC", groupId: null }, media: { kind: "POST", status: "APPROVED" } },
      orderBy: { post: { createdAt: "desc" } },
      take: 400,
      select: { mediaId: true, post: { select: { authorId: true } } },
    });
    for (const r of pm) {
      const l = lastPhotos.get(r.post.authorId) ?? [];
      if (l.length < 3) lastPhotos.set(r.post.authorId, [...l, r.mediaId]);
    }
  }
  const vistaHref = (v: "grade" | "lista") => `/pessoas?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, x]) => typeof x === "string" && k !== "vista")), ...(v === "lista" ? { vista: "lista" } : {}) } as Record<string, string>)}`;
  const confirmed = await import("@/server/testimonials").then((m) => m.confirmedIds(users.map((u) => u.id)));
  const coming = await visitors(viewer, todayBR());
  const alerts = await myAlerts(viewer.id);
  const alertInput = { tipo: sp.tipo, uf: sp.uf, raio: raio ? String(raio) : undefined, curte: sp.curte, foto: sp.foto ? "1" : undefined };
  const canSaveAlert = !("error" in parseAlert(alertInput));
  const afimCount = sp.afim ? null : await db.user.count({ where: { ...where, afimUntil: { gt: new Date() } } });
  const q = String(sp.q ?? "").trim().slice(0, 60);
  const others = q.length >= 2 ? await searchOthers(viewer, q) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">{raio ? "📍 Perto de você" : "Pessoas"}</h1>
        <LocationButton source={viewer.geoSource} city={viewer.city} />
      </div>
      <Link href="/viagens" className="card flex items-center gap-2 px-4 py-2.5 text-sm hover:border-wine/50" data-testid="faixa-viagens">
        <span className="text-lg">✈️</span>
        {coming.items.length > 0 ? (
          <span><b>{coming.items.length}</b> {coming.items.length === 1 ? "visitante chegando" : "visitantes chegando"} {coming.mode === "near" ? "perto de você" : "no seu estado"} nos próximos {TRIPS.soonDays} dias</span>
        ) : (
          <span className="text-mute">Vai viajar? Anuncie e apareça para quem mora no destino</span>
        )}
        <span className="ml-auto text-wine">ver →</span>
      </Link>
      <AfimToggle active={isAfim(viewer)} untilLabel={viewer.afimUntil ? afimUntilLabel(viewer.afimUntil) : undefined} note={viewer.afimNote} />
      {afimCount != null && afimCount > 0 && (
        <Link href={`/pessoas?${new URLSearchParams({ ...(raio ? { raio: String(raio) } : { raio: "br" }), afim: "1" })}`} className="block rounded-lg bg-wine px-4 py-2 text-sm font-semibold text-white hover:bg-wine2" data-testid="afim-faixa">
          🔥 {afimCount} {afimCount === 1 ? "pessoa afim hoje" : "pessoas afim hoje"}{raio ? " perto de você" : ""} — ver →
        </Link>
      )}
      <form className="space-y-2" data-testid="busca-form">
        <div className="flex flex-wrap gap-2">
          <select name="raio" defaultValue={raio ? String(raio) : "br"} className="input w-auto" disabled={!me} title={me ? "" : "Informe sua cidade no perfil"} aria-label="Distância">
            {RADII.map((r) => <option key={r} value={r}>até {r} km</option>)}
            <option value="br">Brasil todo</option>
          </select>
          <input name="q" defaultValue={sp.q} placeholder="Buscar nick, cidade, grupo, evento, conto…" aria-label="Buscar" className="input min-w-40 flex-1" />
          <select name="ordem" defaultValue={ordem} className="input w-auto" aria-label="Ordenar">
            <option value="">{raio ? "📍 Mais perto" : "🟢 Online recente"}</option>
            {raio && <option value="online">🟢 Online recente</option>}
            <option value="novos">✨ Novos usuários</option>
            <option value="afinidade">🔥 Mais afinidade</option>
          </select>
        </div>
        <FiltersToggle count={activeFilters}>
          <select name="tipo" defaultValue={sp.tipo ?? ""} className="input w-auto" aria-label="Tipo de perfil">
            <option value="">Todos os perfis</option>
            <option value="CASAIS">Casais</option>
            {Object.entries(PROFILE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select name="uf" defaultValue={sp.uf ?? ""} className="input w-auto" aria-label="Estado"><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          <span className="flex items-center gap-1 text-sm text-mute">
            Idade
            <input name="idmin" type="number" inputMode="numeric" min={AGE_MIN} max={AGE_MAX} defaultValue={ages.min ?? ""} placeholder={String(AGE_MIN)} className="input w-16 px-2" aria-label="Idade mínima" />
            a
            <input name="idmax" type="number" inputMode="numeric" min={AGE_MIN} max={AGE_MAX} defaultValue={ages.max ?? ""} placeholder={String(AGE_MAX)} className="input w-16 px-2" aria-label="Idade máxima" />
          </span>
          <select name="curte" defaultValue={sp.curte ?? ""} className="input w-auto max-w-56" aria-label="Curte">
            <option value="">Curte…</option>
            {LIKE_GROUPS.map((g) => (
              <optgroup key={g.title} label={g.title}>{g.tags.map((t) => <option key={t}>{t}</option>)}</optgroup>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="afim" defaultChecked={!!sp.afim} /> 🔥 afim hoje</label>
          <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="on" defaultChecked={!!sp.on} /> online</label>
          <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="ver" defaultChecked={!!sp.ver} /> verificados</label>
          <label className="flex items-center gap-1 text-sm text-mute"><input type="checkbox" name="foto" defaultChecked={!!sp.foto} /> com foto</label>
          {activeFilters > 0 && <Link href={`/pessoas?raio=${raio ?? "br"}`} className="self-center text-xs text-wine underline">limpar filtros</Link>}
        </FiltersToggle>
        {lista && <input type="hidden" name="vista" value="lista" />}
        <button className="btn-wine w-full sm:w-auto">Buscar</button>
      </form>
      <div className="flex items-center justify-end gap-1 text-sm" data-testid="vista">
        <span className="mr-1 text-xs text-mute">Ver em</span>
        <Link href={vistaHref("grade")} aria-current={!lista ? "page" : undefined} className={`rounded-full px-3 py-1 ${!lista ? "bg-wine2 text-white" : "text-mute hover:bg-panel2"}`}>▦ Grade</Link>
        <Link href={vistaHref("lista")} aria-current={lista ? "page" : undefined} className={`rounded-full px-3 py-1 ${lista ? "bg-wine2 text-white" : "text-mute hover:bg-panel2"}`}>☰ Lista</Link>
      </div>
      {lista && (
        <ul className="space-y-2" data-testid="lista-pessoas">
          {users.map((u) => {
            const online = u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60_000;
            const invisible = styles[u.id]?.powers.includes("INVISIBLE");
            const photos = lastPhotos.get(u.id) ?? [];
            return (
              <li key={u.id} className="card p-3">
                <Link href={`/u/${u.nick}`} className="flex gap-3">
                  <div className="relative shrink-0">
                    <Avatar mediaId={u.avatarId} nick={u.nick} size={64} style={styles[u.id]} />
                    {online && !invisible && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-panel bg-green-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold"><Nick nick={u.nick} style={styles[u.id]} link={false} />{u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
                    <div className="truncate text-xs text-mute">{PROFILE_TYPES[u.profileType].label}{u.persons.length > 0 && <> · <span className="text-fg/80">{personsLine(u.persons)}</span></>}</div>
                    <div className="truncate text-xs text-mute">{!u.hideCity && u.city ? `${u.city}/` : ""}{u.state}{u.km != null && ` · 📍 ${distanceLabel(u.km)}`}{u.aff != null && u.aff >= 40 && ` · 🔥 ${u.aff}%`}</div>
                    {!invisible && <div className={`text-[11px] ${online ? "font-semibold text-green-700" : "text-mute"}`}>{lastSeenLabel(u.lastSeenAt)}</div>}
                    {isAfim(u) && <div className="mt-0.5 truncate text-[11px] font-semibold text-wine2">🔥 Afim hoje{u.afimNote ? ` · ${u.afimNote}` : ""}</div>}
                  </div>
                </Link>
                {photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5" data-testid="ultimas-fotos">
                    {photos.map((id) => (
                      <Link key={id} href={`/u/${u.nick}#publicacoes`} className="block overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/media/${id}?v=d`} alt="" className="protected-img aspect-square w-full object-cover" draggable={false} />
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className={`${lista ? "hidden" : "grid"} grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5`}>
        {users.map((u) => {
          const online = u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60_000;
          return (
            <Link key={u.id} href={`/u/${u.nick}`} className="card flex min-w-0 flex-col items-center p-4 text-center transition hover:border-wine/50">
              <div className="relative">
                <Avatar mediaId={u.avatarId} nick={u.nick} size={72} style={styles[u.id]} />
                {online && !styles[u.id]?.powers.includes("INVISIBLE") && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-panel bg-green-500" />}
              </div>
              <div className="mt-2 max-w-full truncate text-sm"><Nick nick={u.nick} style={styles[u.id]} link={false} />{u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
              {confirmed.has(u.id) && <div title="Confirmado por quem conheceu pessoalmente" className="mt-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">🤝 Confirmado</div>}
              <div className="text-xs text-mute">{PROFILE_TYPES[u.profileType].label}</div>
              {u.persons.length > 0 && <div className="max-w-full truncate text-[11px] text-fg/80" data-testid="card-pessoas">{personsLine(u.persons)}</div>}
              <div className="max-w-full truncate text-xs text-mute">{!u.hideCity && u.city ? `${u.city}/` : ""}{u.state}</div>
              {!styles[u.id]?.powers.includes("INVISIBLE") && <div className={`text-[11px] ${online ? "font-semibold text-green-700" : "text-mute"}`} data-testid="card-visto">{lastSeenLabel(u.lastSeenAt)}</div>}
              {isAfim(u) && <div title={u.afimNote ?? "Afim de sair hoje"} className="mt-1 max-w-full truncate rounded-full bg-wine px-2 py-0.5 text-[11px] font-semibold text-white" data-testid="afim-selo">🔥 Afim hoje{u.afimNote ? ` · ${u.afimNote}` : ""}</div>}
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {u.km != null && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-wine">📍 {distanceLabel(u.km)}</span>}
                {u.aff != null && u.aff >= 40 && <span className="rounded-full bg-wine px-2 py-0.5 text-[11px] font-semibold text-white" title="Afinidade pelo que vocês curtem">🔥 {u.aff}%</span>}
              </div>
            </Link>
          );
        })}
      </div>
      <SearchAlerts current={alertInput} alerts={alerts} canSave={canSaveAlert} />
      {others && <SearchOthers q={q} r={others} />}
      {users.length === 0 && (
        <p className="card p-6 text-center text-mute">
          Ninguém encontrado com esses filtros{raio ? ` em até ${raio} km` : ""}.{raio && raio < 300 && <> <Link href={`/pessoas?raio=${raio === 100 ? 300 : 100}`} className="text-wine underline">Aumentar o raio</Link></>}
        </p>
      )}
    </div>
  );
}
