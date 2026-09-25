import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTO_CATEGORIES, canDeleteConto, canEditConto, isCategory, readingMinutes } from "@/lib/contos";
import { isStaff, requireUser } from "@/server/auth";
import { getConto, listContos, recordRead } from "@/server/contos";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { ReportButton } from "@/components/ReportButton";
import { ContoCard } from "@/components/ContoCard";
import { ContoDeleteButton, ContoLikeButton } from "@/components/ContoActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // título genérico: a aba e o histórico do navegador não expõem o nome do conto
  void params;
  return { title: "Conto" };
}

export default async function Conto({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await getConto(user, id);
  if (!c) notFound();
  if (!c.deletedAt) await recordRead(user.id, c);
  const cat = isCategory(c.category) ? CONTO_CATEGORIES[c.category] : null;
  const [styles, more] = await Promise.all([
    stylesFor([c.authorId]),
    listContos(user, { order: "populares", page: 1, authorId: c.authorId }),
  ]);
  const others = more.items.filter((o) => o.id !== c.id).slice(0, 3);
  const mine = c.authorId === user.id;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/contos" className="text-sm text-mute hover:text-fg">← Contos</Link>
      {c.deletedAt && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Este conto foi removido e só a equipe o vê.</p>}
      <article className="card p-5 sm:p-7">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-mute">
          {cat && <Link href={`/contos?cat=${c.category}`} className="rounded-full bg-wine/10 px-2 py-0.5 font-medium text-wine hover:bg-wine/20">{cat.emoji} {cat.label}</Link>}
          <span>{readingMinutes(c.body)} min de leitura</span>
          <span>· 👁 {c.readCount} {c.readCount === 1 ? "leitura" : "leituras"}</span>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight sm:text-3xl">{c.title}</h1>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Link href={`/u/${encodeURIComponent(c.author.nick)}`}><Avatar mediaId={c.author.avatarId} nick={c.author.nick} size={32} style={styles[c.authorId]} /></Link>
          <span>por <Nick nick={c.author.nick} style={styles[c.authorId]} />{c.author.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</span>
          <span className="text-mute">· {c.createdAt.toLocaleDateString("pt-BR")}{c.updatedAt.getTime() - c.createdAt.getTime() > 60_000 ? " (editado)" : ""}</span>
        </div>
        <div className="mt-5 space-y-4 text-[1.05rem] leading-relaxed">
          {c.body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {!c.deletedAt && <ContoLikeButton id={c.id} liked={c.liked} count={c.likeCount} disabled={mine} />}
          <div className="ml-auto flex items-center gap-3">
            {canEditConto(c, user) && <Link href={`/contos/${c.id}/editar`} className="text-xs text-mute hover:text-fg">✏️ Editar</Link>}
            {canDeleteConto(c, user) && <ContoDeleteButton id={c.id} staff={!mine && isStaff(user)} />}
            {!mine && !c.deletedAt && <ReportButton targetType="CONTO" targetId={c.id} />}
          </div>
        </div>
      </article>
      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Mais contos de @{c.author.nick}</h2>
          {others.map((o) => <ContoCard key={o.id} c={o} compact />)}
        </section>
      )}
    </div>
  );
}
