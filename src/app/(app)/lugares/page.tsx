import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import Link from "next/link";
import { db } from "@/lib/db";
import { UFS, UF_NAMES } from "@/lib/config";
import { PLACE_KINDS, type PlaceKind, avgStars } from "@/lib/places";
import { isVerified, requireUser } from "@/server/auth";
import { listPlaces } from "@/server/places";

export const metadata = { title: "Lugares" };
export const dynamic = "force-dynamic";

export default async function Lugares({ searchParams }: { searchParams: Promise<{ uf?: string; cidade?: string; tipo?: string }> }) {
  if (!FEATURES.lugares) notFound();
  const user = await requireUser();
  const sp = await searchParams;
  const uf = typeof sp.uf === "string" && UFS.includes(sp.uf) ? sp.uf : sp.uf === "" ? "" : user.state && !sp.cidade ? user.state : "";
  const cidade = typeof sp.cidade === "string" ? sp.cidade.trim().slice(0, 80) : "";
  const tipo = typeof sp.tipo === "string" && sp.tipo in PLACE_KINDS ? (sp.tipo as PlaceKind) : undefined;
  const [places, mine] = await Promise.all([
    listPlaces({ state: uf || undefined, city: cidade || undefined, kind: tipo }),
    db.place.findMany({ where: { suggestedById: user.id, status: { in: ["PENDING", "REJECTED"] } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">📍 Lugares</h1>
        {isVerified(user) ? <Link href="/lugares/novo" className="btn-gold">+ Sugerir lugar</Link> : <Link href="/verificacao" className="btn-ghost" title="Verifique seu perfil para sugerir">+ Sugerir lugar</Link>}
      </div>
      <p className="text-sm text-mute">Casas de swing, bares, saunas e praias do meio liberal, avaliados por perfis verificados. Marque “Vou hoje” e veja quem também vai.</p>
      <form className="flex flex-wrap gap-2">
        <select name="uf" defaultValue={uf} className="input w-auto" aria-label="Estado">
          <option value="">Todo o Brasil</option>
          {UFS.map((u) => <option key={u} value={u}>{UF_NAMES[u]}</option>)}
        </select>
        <input name="cidade" defaultValue={cidade} placeholder="Cidade" className="input min-w-32 flex-1" aria-label="Cidade" />
        <select name="tipo" defaultValue={tipo ?? ""} className="input w-auto" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(PLACE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <button className="btn-wine">Filtrar</button>
      </form>
      {mine.length > 0 && (
        <section className="card p-3 text-sm">
          <h2 className="mb-1 font-semibold">Suas sugestões</h2>
          <ul className="space-y-1">
            {mine.map((p) => (
              <li key={p.id}><Link href={`/lugares/${p.id}`} className="hover:text-wine">{p.name}</Link> <span className="text-xs text-mute">· {p.status === "PENDING" ? "em análise" : `não aceita${p.reviewNote ? `: ${p.reviewNote}` : ""}`}</span></li>
            ))}
          </ul>
        </section>
      )}
      {places.length === 0 ? (
        <div className="card p-8 text-center text-mute">
          <p className="text-4xl">🗺️</p>
          <p className="mt-2">Nenhum lugar {uf ? `em ${UF_NAMES[uf]}` : "cadastrado"} ainda.</p>
          <p className="mt-1 text-sm">Conhece um? Sugira e ajude a comunidade.</p>
          {uf && <Link href="/lugares?uf=" className="mt-2 inline-block text-sm text-wine underline">Ver o Brasil todo</Link>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((p) => {
            const avg = avgStars(p.ratingSum, p.ratingCount);
            return (
              <Link key={p.id} href={`/lugares/${p.id}`} className="card block p-4 hover:border-wine/50" data-testid="lugar">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">{PLACE_KINDS[p.kind as PlaceKind]?.icon ?? "📍"}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <p className="text-xs text-mute">{PLACE_KINDS[p.kind as PlaceKind]?.label} · {p.city}/{p.state}</p>
                    <p className="mt-1 text-xs">{avg != null ? <><span className="text-gold">★ {avg.toLocaleString("pt-BR")}</span> <span className="text-mute">({p.ratingCount})</span></> : <span className="text-mute">sem avaliações</span>}</p>
                  </div>
                  {p.goingToday > 0 && <span className="shrink-0 rounded-full bg-wine px-2 py-0.5 text-[11px] font-semibold text-white" data-testid="vao-hoje">🔥 {p.goingToday} vão hoje</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
