import Link from "next/link";
import { db } from "@/lib/db";
import { blockedIds } from "@/server/access";
import { CONTO_CATEGORIES, isCategory } from "@/lib/contos";
import { isVerified, requireUser } from "@/server/auth";
import { listContos } from "@/server/contos";
import { ContoCard } from "@/components/ContoCard";

export const metadata = { title: "Contos eróticos" };
export const dynamic = "force-dynamic";

export default async function Contos({ searchParams }: { searchParams: Promise<{ cat?: string; ordem?: string; p?: string; meus?: string; autor?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const category = isCategory(sp.cat) ? sp.cat : undefined;
  const order = sp.ordem === "populares" ? "populares" : "recentes";
  const mine = sp.meus === "1";
  const autor = !mine && sp.autor ? await db.user.findFirst({ where: { nick: String(sp.autor).slice(0, 24), status: "ACTIVE", id: { notIn: await blockedIds(user.id) } }, select: { id: true, nick: true } }) : null;
  const page = Math.max(1, Math.min(500, Number(sp.p) || 1));
  const { items, total, pages } = await listContos(user, { category, order, page, authorId: mine ? user.id : autor?.id });
  const q = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const all = { cat: category, ordem: order === "populares" ? "populares" : undefined, meus: mine ? "1" : undefined, autor: autor?.nick, ...o };
    for (const [k, v] of Object.entries(all)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/contos?${s}` : "/contos";
  };
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ${on ? "bg-wine text-white" : "border border-line text-mute hover:text-fg"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">📖 Contos{autor && <span className="text-lg font-normal text-mute"> de @{autor.nick} · <Link href="/contos" className="underline">todos</Link></span>}</h1>
        {isVerified(user) ? (
          <Link href="/contos/novo" className="btn-gold">✍️ Escrever conto</Link>
        ) : (
          <Link href="/verificacao" className="btn-ghost" title="Só perfis verificados publicam contos">✔ Verifique-se para escrever</Link>
        )}
      </div>
      <p className="text-sm text-mute">Histórias reais e fantasias da comunidade. Só adultos, sempre com consentimento: contos com menores, incesto, violência sexual ou zoofilia são removidos e a conta é banida.</p>

      <div className="flex flex-wrap gap-2" aria-label="Ordem">
        <Link href={q({ ordem: undefined, p: undefined })} className={chip(order === "recentes" && !mine)}>🕒 Recentes</Link>
        <Link href={q({ ordem: "populares", p: undefined })} className={chip(order === "populares" && !mine)}>❤ Mais curtidos</Link>
        <Link href={q({ meus: mine ? undefined : "1", p: undefined })} className={chip(mine)}>✍️ Meus contos</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorias">
        <Link href={q({ cat: undefined, p: undefined })} className={`shrink-0 ${chip(!category)}`}>Todas</Link>
        {Object.entries(CONTO_CATEGORIES).map(([k, c]) => (
          <Link key={k} href={q({ cat: k, p: undefined })} className={`shrink-0 ${chip(category === k)}`}>{c.emoji} {c.label}</Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="card p-8 text-center text-mute">{mine ? "Você ainda não publicou contos." : "Nenhum conto aqui ainda. Que tal escrever o primeiro?"}</p>
      ) : (
        <div className="space-y-3">{items.map((c) => <ContoCard key={c.id} c={c} />)}</div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">
          {page > 1 && <Link href={q({ p: String(page - 1) })} className="btn-ghost py-1">← Anterior</Link>}
          <span className="text-mute">Página {page} de {pages} · {total} contos</span>
          {page < pages && <Link href={q({ p: String(page + 1) })} className="btn-ghost py-1">Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
