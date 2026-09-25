import { FEATURES } from "@/lib/features";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PLACE_KINDS, type PlaceKind, avgStars, starsText } from "@/lib/places";
import { isStaff, isVerified, requireUser } from "@/server/auth";
import { getPlace, goingToday, placeReviews } from "@/server/places";
import { deleteReview, reviewPlace, saveReview, toggleCheckin } from "@/app/actions/places";
import { ActionForm } from "@/components/Forms";
import { Avatar } from "@/components/Avatar";
import { ReportButton } from "@/components/ReportButton";

export const dynamic = "force-dynamic";

export default async function Lugar({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.lugares) notFound();
  const viewer = await requireUser();
  const { id } = await params;
  const p = await getPlace(viewer, id);
  if (!p) notFound();
  const [reviews, going, mine] = await Promise.all([
    placeReviews(viewer, id),
    goingToday(viewer, id),
    db.placeReview.findUnique({ where: { placeId_userId: { placeId: id, userId: viewer.id } } }),
  ]);
  const avg = avgStars(p.ratingSum, p.ratingCount);
  const kind = PLACE_KINDS[p.kind as PlaceKind];
  const verified = isVerified(viewer);
  const approved = p.status === "APPROVED";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/lugares?uf=${p.state}`} className="text-sm text-mute hover:text-fg">← Lugares</Link>
      <section className="card space-y-2 p-5">
        {!approved && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{p.status === "PENDING" ? "⏳ Em análise pela equipe — só você e a equipe veem." : `Não aceito${p.reviewNote ? `: ${p.reviewNote}` : ""}.`}</p>}
        <div className="flex items-start gap-3">
          <span className="text-4xl">{kind?.icon ?? "📍"}</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{p.name}</h1>
            <p className="text-sm text-mute">{kind?.label} · {p.city}/{p.state}{p.address ? ` · ${p.address}` : ""}</p>
            <p className="mt-1 text-sm" data-testid="nota">{avg != null ? <><span className="text-gold">{starsText(avg)}</span> <b>{avg.toLocaleString("pt-BR")}</b> <span className="text-mute">({p.ratingCount} {p.ratingCount === 1 ? "avaliação" : "avaliações"})</span></> : <span className="text-mute">Ainda sem avaliações</span>}</p>
            {p.site && <a href={p.site} target="_blank" rel="nofollow noopener noreferrer ugc" className="text-sm text-wine underline">{new URL(p.site).hostname} ↗</a>}
          </div>
        </div>
        {p.description && <p className="whitespace-pre-wrap text-sm">{p.description}</p>}
        <p className="text-[11px] text-mute">Sugerido por @{p.suggestedBy.nick}</p>
        {isStaff(viewer) && (
          <form action={reviewPlace.bind(null, p.id)} className="flex flex-wrap gap-2 border-t border-line pt-2">
            <input name="note" placeholder="Nota (opcional)" className="input w-48 py-1 text-xs" />
            {p.status !== "APPROVED" && <button name="op" value="approve" className="btn-gold py-1 text-xs">Aprovar</button>}
            {p.status === "PENDING" && <button name="op" value="reject" className="btn-ghost py-1 text-xs">Recusar</button>}
            {p.status === "APPROVED" && <button name="op" value="remove" className="btn-wine py-1 text-xs">Remover do guia</button>}
          </form>
        )}
      </section>

      {approved && (
        <section className="card space-y-3 p-4" aria-label="Vou hoje">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">🔥 Quem vai hoje <span className="text-sm font-normal text-mute" data-testid="vao-count">({going.count})</span></h2>
            {verified ? (
              <form action={toggleCheckin.bind(null, p.id)}>
                <button className={going.mine ? "btn-ghost" : "btn-wine"} data-testid="vou-hoje">{going.mine ? "✓ Vou hoje (desmarcar)" : "Vou hoje"}</button>
              </form>
            ) : (
              <Link href="/verificacao" className="btn-ghost text-sm">Verifique-se para marcar</Link>
            )}
          </div>
          {going.canSee ? (
            going.people.length > 0 ? (
              <div className="flex flex-wrap gap-3" data-testid="vao-lista">
                {going.people.map((u) => (
                  <Link key={u.id} href={`/u/${u.nick}`} className="flex w-16 flex-col items-center text-center text-[11px]">
                    <Avatar mediaId={u.avatarId} nick={u.nick} size={48} />
                    <span className="mt-1 w-full truncate">@{u.nick}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">Ninguém marcou ainda. Vai? Marque e apareça para quem também vai.</p>
            )
          ) : (
            <p className="text-sm text-mute" data-testid="vao-oculto">Só perfis verificados veem quem vai.</p>
          )}
          <p className="text-[11px] text-mute">“Vou hoje” some sozinho à meia-noite e só aparece para perfis verificados.</p>
        </section>
      )}

      {approved && (
        <section className="card space-y-3 p-4" aria-label="Avaliações">
          <h2 className="font-semibold">⭐ Avaliações</h2>
          {verified ? (
            <ActionForm action={saveReview.bind(null, p.id)} className="space-y-2" okText="Avaliação salva!">
              <div className="flex items-center gap-2">
                <label htmlFor="stars" className="text-sm">{mine ? "Sua nota" : "Dê sua nota"}</label>
                <select id="stars" name="stars" defaultValue={mine?.stars ?? 5} className="input w-auto">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)} ({n})</option>)}
                </select>
              </div>
              <textarea name="body" rows={3} maxLength={1000} defaultValue={mine?.body ?? ""} className="input" placeholder="Como foi? Público, ambiente, atendimento… (sem telefone)" />
              <div className="flex gap-2">
                <button className="btn-gold">{mine ? "Atualizar avaliação" : "Publicar avaliação"}</button>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-mute"><Link href="/verificacao" className="text-wine underline">Verifique seu perfil</Link> para avaliar.</p>
          )}
          {mine && <form action={deleteReview.bind(null, p.id)}><button className="text-xs text-mute underline">Apagar minha avaliação</button></form>}
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="group flex gap-3 py-3" data-testid="avaliacao">
                <Avatar mediaId={r.user.avatarId} nick={r.user.nick} size={36} />
                <div className="min-w-0 flex-1 text-sm">
                  <p><Link href={`/u/${r.user.nick}`} className="font-semibold hover:text-wine">@{r.user.nick}</Link> <span className="text-gold">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span> <span className="text-xs text-mute">{r.updatedAt.toLocaleDateString("pt-BR")}</span></p>
                  {r.body && <p className="whitespace-pre-wrap break-words">{r.body}</p>}
                </div>
                {r.userId !== viewer.id && <ReportButton targetType="PLACE_REVIEW" targetId={r.id} label="" className="hidden self-start group-hover:inline" />}
              </li>
            ))}
            {reviews.length === 0 && <li className="py-3 text-sm text-mute">Seja a primeira pessoa a avaliar.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
