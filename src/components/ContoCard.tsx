import Link from "next/link";
import { CONTO_CATEGORIES, excerpt, isCategory, readingMinutes } from "@/lib/contos";
import { timeAgo } from "@/lib/time";

type C = { id: string; title: string; category: string; body: string; likeCount: number; readCount: number; commentCount: number; createdAt: Date; author: { nick: string } };

/** Cartão de conto para as listas (sem foto: título, categoria, prévia e números). */
export function ContoCard({ c, compact = false }: { c: C; compact?: boolean }) {
  const cat = isCategory(c.category) ? CONTO_CATEGORIES[c.category] : null;
  return (
    <Link href={`/contos/${c.id}`} className="card block p-4 transition hover:border-wine">
      <div className="mb-1 flex items-center gap-2 text-xs text-mute">
        {cat && <span className="rounded-full bg-wine/10 px-2 py-0.5 font-medium text-wine">{cat.emoji} {cat.label}</span>}
        <span>{readingMinutes(c.body)} min de leitura</span>
      </div>
      <h3 className="font-semibold leading-snug">{c.title}</h3>
      {!compact && <p className="mt-1 text-sm text-mute">{excerpt(c.body)}</p>}
      <div className="mt-2 flex items-center gap-3 text-xs text-mute">
        <span>por @{c.author.nick}</span>
        <span>· {timeAgo(c.createdAt)}</span>
        <span className="ml-auto" title="Curtidas">❤ {c.likeCount}</span>
        <span title="Comentários">💬 {c.commentCount}</span>
        <span title="Leituras">👁 {c.readCount}</span>
      </div>
    </Link>
  );
}
