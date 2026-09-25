import Link from "next/link";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES, agesLabel } from "@/lib/config";
import { isVerified, requireUser } from "@/server/auth";
import { likesReceivedCount, nextCandidate } from "@/server/paquera";
import { Nick } from "@/components/Nick";
import { ProtectedImage } from "@/components/ProtectedImage";
import { PaqueraActions } from "@/components/PaqueraCard";
import { PaqueraTabs } from "@/components/PaqueraTabs";

export const metadata = { title: "Paquera" };
export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [["", "Todos"], ["CASAIS", "Casais"], ["SINGLE_WOMAN", "Mulheres"], ["SINGLE_MAN", "Homens"], ["TRANS", "Trans"]];

export default async function Paquera({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await requireUser();
  const { tipo = "" } = await searchParams;
  const likes = await likesReceivedCount(user.id);
  if (!isVerified(user))
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PaqueraTabs active="paquera" likes={likes} />
        <p className="card p-6 text-center text-sm">A Paquera é só entre perfis verificados, para ninguém cair em perfil falso. <Link href="/verificacao" className="text-gold underline">Verificar agora</Link></p>
      </div>
    );
  const c = await nextCandidate(user, tipo || undefined);
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PaqueraTabs active="paquera" likes={likes} />
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={k ? `/paquera?tipo=${k}` : "/paquera"} className={`rounded-full px-2.5 py-1 text-xs ${tipo === k ? "bg-pink-100 font-semibold text-wine" : "text-mute"}`}>{l}</Link>
        ))}
      </div>
      {!c ? (
        <p className="card p-8 text-center text-mute">Você já viu todo mundo por aqui 🔥. Volte mais tarde: perfis novos chegam todo dia.</p>
      ) : (
        <article className="card overflow-hidden" data-testid="paquera-card">
          <div className="relative">
            <ProtectedImage id={c.avatarId!} className="h-[46vh] max-h-[520px] min-h-[260px] w-full" />
            {c.likesMe && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-wine">💘 Curtiu vocês</span>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
              <p className="text-xl font-bold"><Nick nick={c.nick} style={c.style} link={false} /> <span className="text-sm font-normal text-white/90">✔</span></p>
              <p className="text-sm text-white/90">
                {PROFILE_TYPES[c.profileType].label} · {agesLabel(c.persons.map((p) => ({ label: p.label, age: ageOn(p.birthDate) })))}
                {!c.hideCity && c.city ? ` · ${c.city}/${c.state}` : c.state ? ` · ${c.state}` : ""}
              </p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {c.bio && <p className="line-clamp-3 text-sm">{c.bio}</p>}
            {Array.isArray(c.likes) && c.likes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{(c.likes as string[]).slice(0, 6).map((t) => <span key={t} className="rounded-full border border-line px-2 py-0.5 text-xs text-mute">{t}</span>)}</div>
            )}
            <Link href={`/u/${encodeURIComponent(c.nick)}`} className="block text-center text-xs text-mute underline">Ver perfil completo</Link>
            <PaqueraActions targetId={c.id} nick={c.nick} />
          </div>
        </article>
      )}
    </div>
  );
}
