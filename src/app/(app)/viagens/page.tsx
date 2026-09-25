import Link from "next/link";
import { PROFILE_TYPES, UFS, UF_NAMES } from "@/lib/config";
import { todayBR, tripDates, tripPhase, TRIPS } from "@/lib/trips";
import { requireUser } from "@/server/auth";
import { myTrips, visitors } from "@/server/trips";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { TripDeleteButton, TripForm } from "@/components/TripForm";

export const metadata = { title: "Viagens" };
export const dynamic = "force-dynamic";

const PHASE = { now: { t: "Já está lá", c: "bg-emerald-50 text-emerald-800" }, soon: { t: "Chegando", c: "bg-pink-50 text-wine" }, later: { t: "Marcada", c: "bg-black/5 text-mute" }, past: { t: "", c: "" } };

export default async function Viagens({ searchParams }: { searchParams: Promise<{ uf?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const uf = sp.uf && UFS.includes(sp.uf) ? sp.uf : undefined;
  const today = todayBR();
  const [v, mine] = await Promise.all([visitors(user, today, { uf }), myTrips(user.id, today)]);
  const styles = await stylesFor(v.items.map((t) => t.userId));
  const where = v.mode === "near" ? `perto de você (até ${TRIPS.radiusKm} km)` : v.uf ? `em ${UF_NAMES[v.uf]}` : "no seu estado";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">✈️ Viagens</h1>
          <form className="flex gap-2">
            <select name="uf" defaultValue={uf ?? ""} className="input w-auto" aria-label="Destino">
              <option value="">{user.lat != null ? "Perto de mim" : "Meu estado"}</option>
              {UFS.map((u) => <option key={u} value={u}>{UF_NAMES[u]}</option>)}
            </select>
            <button className="btn-ghost">Ver</button>
          </form>
        </div>
        <p className="text-sm text-mute">Quem está chegando {where} nos próximos {TRIPS.soonDays} dias. Viajando também? Anuncie ao lado e apareça para quem mora no destino.</p>
        {v.items.length === 0 ? (
          <p className="card p-8 text-center text-mute">Ninguém anunciou viagem para {v.mode === "near" ? "perto de você" : "cá"} por enquanto.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="visitantes">
            {v.items.map((t) => {
              const ph = PHASE[tripPhase(t, today)];
              return (
                <Link key={t.id} href={`/u/${encodeURIComponent(t.user.nick)}`} className="card flex min-w-0 items-center gap-3 p-3 hover:border-wine/50">
                  <Avatar mediaId={t.user.avatarId} nick={t.user.nick} size={56} style={styles[t.userId]} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm"><Nick nick={t.user.nick} style={styles[t.userId]} link={false} />{t.user.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
                    <div className="truncate text-xs text-mute">{PROFILE_TYPES[t.user.profileType].label}{!t.user.hideCity && t.user.city ? ` · de ${t.user.city}/${t.user.state}` : t.user.state ? ` · de ${t.user.state}` : ""}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${ph.c}`}>{ph.t}</span>
                      <span className="font-medium">{t.city}/{t.state}</span>
                      <span className="text-mute">· {tripDates(t.from, t.to)}</span>
                    </div>
                    {t.note && <p className="mt-1 truncate text-xs italic text-mute">“{t.note}”</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Estou viajando</h2>
          <TripForm today={today} defaultState={user.state ?? "SP"} />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Minhas viagens</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-mute">Nenhuma viagem marcada.</p>
          ) : (
            <ul className="divide-y divide-line" data-testid="minhas-viagens">
              {mine.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.city}/{t.state}</div>
                    <div className="text-xs text-mute">{tripDates(t.from, t.to)} · {PHASE[tripPhase(t, today)].t}</div>
                  </div>
                  <TripDeleteButton id={t.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-mute">A viagem aparece no seu perfil e some sozinha depois da volta. Bloqueados não veem.</p>
        </section>
      </aside>
    </div>
  );
}
