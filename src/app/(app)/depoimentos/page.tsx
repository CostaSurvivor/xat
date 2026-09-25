import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { requireUser } from "@/server/auth";
import { deleteMyTestimonial, reviewTestimonial } from "@/app/actions/testimonials";

export const metadata = { title: "Depoimentos" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  PENDING: ["Aguardando aprovação", "bg-amber-50 text-amber-800"],
  APPROVED: ["Publicado no perfil", "bg-emerald-50 text-emerald-800"],
  HIDDEN: ["Oculto", "bg-panel2 text-mute"],
};

export default async function Depoimentos({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireUser();
  const { aba = "recebidos" } = await searchParams;
  const sent = aba === "enviados";
  const [received, written] = await Promise.all([
    db.testimonial.findMany({
      where: { profileId: user.id, withdrawnAt: null },
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: { author: { select: { nick: true } } },
    }),
    db.testimonial.findMany({ where: { authorId: user.id, withdrawnAt: null }, orderBy: { updatedAt: "desc" }, take: 100, include: { profile: { select: { nick: true } } } }),
  ]);
  // pendentes primeiro
  received.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));
  const pending = received.filter((t) => t.status === "PENDING").length;
  const tab = (key: string, label: string) => (
    <Link href={`/depoimentos?aba=${key}`} className={`rounded-full px-3 py-1.5 text-sm ${aba === key ? "bg-wine2 text-white" : "border border-line text-mute"}`}>{label}</Link>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">📝 Depoimentos</h1>
        <p className="text-sm text-mute">Referências de quem conheceu vocês. Só aparecem no perfil depois que vocês aprovam.</p>
      </div>
      <div className="flex gap-2">
        {tab("recebidos", `Recebidos${pending ? ` (${pending} novo${pending > 1 ? "s" : ""})` : ""}`)}
        {tab("enviados", `Que escrevi (${written.length})`)}
      </div>

      {!sent && received.length === 0 && <p className="card p-8 text-center text-mute">Nenhum depoimento ainda. Quem conheceu vocês pode deixar um no seu perfil.</p>}
      {!sent &&
        received.map((t) => (
          <article key={t.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link href={`/u/${t.author.nick}`} className="font-semibold text-fg hover:underline">@{t.author.nick}</Link>
              <span className="text-mute">· {timeAgo(t.updatedAt)}</span>
              {t.metInPerson && <span className="text-emerald-700">· 🤝 conheceu pessoalmente</span>}
              <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${STATUS[t.status][1]}`}>{STATUS[t.status][0]}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{t.body}</p>
            <div className="flex flex-wrap gap-2">
              {t.status !== "APPROVED" && <form action={reviewTestimonial.bind(null, t.id, "approve")}><button className="btn-gold py-1 text-xs">✓ Aprovar e publicar</button></form>}
              {t.status !== "HIDDEN" && <form action={reviewTestimonial.bind(null, t.id, "hide")}><button className="btn-ghost py-1 text-xs">{t.status === "APPROVED" ? "Tirar do perfil" : "Não publicar"}</button></form>}
              <form action={reviewTestimonial.bind(null, t.id, "delete")}><button className="btn-ghost py-1 text-xs text-red-700">Excluir</button></form>
            </div>
          </article>
        ))}

      {sent && written.length === 0 && <p className="card p-8 text-center text-mute">Você ainda não escreveu depoimentos. Abra o perfil de quem você conheceu e deixe o seu.</p>}
      {sent &&
        written.map((t) => (
          <article key={t.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-mute">Para</span>
              <Link href={`/u/${t.profile.nick}#depoimentos`} className="font-semibold text-fg hover:underline">@{t.profile.nick}</Link>
              <span className="text-mute">· {timeAgo(t.updatedAt)}</span>
              {/* "oculto" não é mostrado ao autor: aparece como aguardando */}
              <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${STATUS[t.status === "HIDDEN" ? "PENDING" : t.status][1]}`}>{STATUS[t.status === "HIDDEN" ? "PENDING" : t.status][0]}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{t.body}</p>
            <div className="flex gap-2">
              <Link href={`/u/${t.profile.nick}#depoimentos`} className="btn-ghost py-1 text-xs">Editar</Link>
              <form action={deleteMyTestimonial.bind(null, t.id)}><button className="btn-ghost py-1 text-xs text-red-700">Apagar</button></form>
            </div>
          </article>
        ))}
    </div>
  );
}
