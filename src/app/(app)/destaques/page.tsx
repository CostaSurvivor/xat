import Link from "next/link";
import { PROFILE_TYPES, UFS, UF_NAMES } from "@/lib/config";
import { MEDALS, PERIODS, PROFILE_GROUPS, groupOf, periodOf, type ProfileGroup } from "@/lib/ranking";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { requireUser } from "@/server/auth";
import { topPhotos, topProfiles } from "@/server/ranking";

export const metadata = { title: "Destaques" };
export const dynamic = "force-dynamic";

type SP = { aba?: string; p?: string; uf?: string; g?: string };

export default async function Destaques({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const aba = sp.aba === "perfis" ? "perfis" : "fotos";
  const period = periodOf(sp.p);
  const days = PERIODS[period];
  const uf = sp.uf && UFS.includes(sp.uf) ? sp.uf : undefined;
  const group = groupOf(sp.g);
  const q = (o: Partial<SP>) => `/destaques?${new URLSearchParams(Object.entries({ aba, p: period, uf: uf ?? "", g: group, ...o }).filter(([, v]) => v) as [string, string][])}`;
  const tab = (active: boolean) => `rounded-full px-3 py-1.5 text-sm ${active ? "bg-wine text-white" : "border border-line bg-panel text-mute hover:text-fg"}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🔥 Destaques</h1>
        <p className="text-sm text-mute">O que a comunidade mais curtiu {period === "semana" ? "nos últimos 7 dias" : "nos últimos 30 dias"}. Contam reações e comentários de perfis verificados (o próprio autor não conta).</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={q({ aba: "fotos" })} className={tab(aba === "fotos")}>📸 Fotos em alta</Link>
        <Link href={q({ aba: "perfis" })} className={tab(aba === "perfis")}>👑 Perfis mais curtidos</Link>
        <span className="mx-1 self-center text-line">|</span>
        <Link href={q({ p: "semana" })} className={tab(period === "semana")}>Semana</Link>
        <Link href={q({ p: "mes" })} className={tab(period === "mes")}>Mês</Link>
      </div>

      {aba === "fotos" ? (
        <Photos user={user} days={days} uf={uf} q={q} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROFILE_GROUPS) as ProfileGroup[]).map((g) => (
              <Link key={g} href={q({ g })} className={tab(group === g)}>{PROFILE_GROUPS[g].label}</Link>
            ))}
          </div>
          <Profiles user={user} days={days} group={group} />
        </>
      )}
    </div>
  );
}

async function Photos({ user, days, uf, q }: { user: Awaited<ReturnType<typeof requireUser>>; days: number; uf?: string; q: (o: Partial<SP>) => string }) {
  const items = await topPhotos(user, days, uf);
  return (
    <>
      <form action="/destaques" className="flex gap-2">
        <input type="hidden" name="aba" value="fotos" />
        <input type="hidden" name="p" value={days === 30 ? "mes" : "semana"} />
        <select name="uf" defaultValue={uf ?? ""} className="input w-auto">
          <option value="">Brasil todo</option>
          {UFS.map((u) => <option key={u} value={u}>{UF_NAMES[u]}</option>)}
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-mute">
          <p className="text-4xl">📸</p>
          <p className="mt-2">Ainda não há fotos em alta {uf ? `em ${UF_NAMES[uf]}` : "neste período"}. Poste uma foto e reaja às dos outros!</p>
          {uf && <Link href={q({ uf: "" })} className="mt-3 inline-block text-wine underline">Ver o Brasil todo</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ post, score }, i) => {
            const photo = post.media.find((m) => !m.video)!;
            return (
              <Link key={post.id} href={`/post/${post.id}`} className="card group relative block min-w-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${photo.id}?v=d`} alt="" className="protected-img aspect-square w-full object-cover transition group-hover:scale-[1.02]" draggable={false} />
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-sm font-bold text-wine shadow">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">🔥 {score}</span>
                <div className="flex items-center gap-2 p-2">
                  <Avatar mediaId={post.author.avatarId} nick={post.author.nick} size={24} style={post.author.style} />
                  <span className="min-w-0 truncate text-xs"><Nick nick={post.author.nick} style={post.author.style} link={false} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

async function Profiles({ user, days, group }: { user: Awaited<ReturnType<typeof requireUser>>; days: number; group: ProfileGroup }) {
  const list = await topProfiles(user, days, group);
  if (!list.length) return <p className="card p-8 text-center text-mute">Ninguém pontuou neste período ainda. 🔥</p>;
  return (
    <div className="card divide-y divide-line">
      {list.map((u, i) => (
        <Link key={u.id} href={`/u/${encodeURIComponent(u.nick)}`} className="flex items-center gap-3 p-3 hover:bg-black/5">
          <span className="w-8 shrink-0 text-center text-lg font-bold text-wine">{MEDALS[i] ?? i + 1}</span>
          <Avatar mediaId={u.avatarId} nick={u.nick} size={44} style={u.style} />
          <div className="min-w-0 flex-1">
            <Nick nick={u.nick} style={u.style} link={false} />
            {u.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}
            <p className="truncate text-xs text-mute">{PROFILE_TYPES[u.profileType as keyof typeof PROFILE_TYPES]?.label}{!u.hideCity && u.city ? ` · ${u.city}/${u.state}` : u.state ? ` · ${u.state}` : ""}</p>
          </div>
          <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-sm font-semibold text-wine">🔥 {u.score}</span>
        </Link>
      ))}
    </div>
  );
}
