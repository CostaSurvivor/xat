import Link from "next/link";
import { db } from "@/lib/db";
import { PROFILE_TYPES } from "@/lib/config";
import { FAVORITES } from "@/lib/favorites";
import { isStaff, isVerified, requireUser } from "@/server/auth";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";
import { Avatar } from "@/components/Avatar";
import { Nick } from "@/components/Nick";
import { NoteForm } from "@/components/Favorite";

export const metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

/** Lista privada: ninguém sabe que está nos seus favoritos. */
export default async function Favoritos({ searchParams }: { searchParams: Promise<{ on?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const online = sp.on === "1";
  const q = String(sp.q ?? "").trim().slice(0, 40);
  const blocked = await blockedIds(user.id);
  const favs = await db.favorite.findMany({
    where: {
      ownerId: user.id,
      targetId: blocked.length ? { notIn: blocked } : undefined,
      target: {
        status: "ACTIVE",
        ...(isVerified(user) || isStaff(user) ? {} : { hideFromUnverified: false }),
        ...(online ? { lastSeenAt: { gt: new Date(Date.now() - 5 * 60_000) } } : {}),
      },
      ...(q ? { OR: [{ target: { nick: { contains: q } } }, { note: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: FAVORITES.max,
    include: { target: { select: { id: true, nick: true, avatarId: true, profileType: true, city: true, state: true, hideCity: true, lastSeenAt: true, ageVerification: true } } },
  });
  const total = await db.favorite.count({ where: { ownerId: user.id } });
  const styles = await stylesFor(favs.map((f) => f.targetId));
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ${on ? "bg-wine text-white" : "border border-line text-mute hover:text-fg"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">⭐ Favoritos</h1>
        <span className="text-sm text-mute">{total}/{FAVORITES.max}</span>
      </div>
      <p className="text-sm text-mute">🔒 Lista secreta: ninguém é avisado nem sabe que está aqui. As anotações também são só suas.</p>
      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nick ou anotação" className="input min-w-40 flex-1" />
        {online && <input type="hidden" name="on" value="1" />}
        <button className="btn-ghost">Buscar</button>
        <Link href={online ? `/favoritos${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/favoritos?on=1${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={chip(online)}>🟢 Online agora</Link>
      </form>
      {favs.length === 0 ? (
        <p className="card p-8 text-center text-mute">{total === 0 ? "Nenhum favorito ainda. Toque em ☆ Favoritar no perfil de alguém." : "Ninguém encontrado com esse filtro."}</p>
      ) : (
        <ul className="space-y-3" data-testid="favoritos">
          {favs.map((f) => {
            const t = f.target;
            const on = t.lastSeenAt && Date.now() - t.lastSeenAt.getTime() < 5 * 60_000;
            return (
              <li key={f.targetId} className="card p-4">
                <Link href={`/u/${encodeURIComponent(t.nick)}`} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar mediaId={t.avatarId} nick={t.nick} size={52} style={styles[t.id]} />
                    {on && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-green-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm"><Nick nick={t.nick} style={styles[t.id]} link={false} />{t.ageVerification === "APPROVED" && <span className="ml-1 text-xs text-gold">✔</span>}</div>
                    <div className="truncate text-xs text-mute">{PROFILE_TYPES[t.profileType].label}{!t.hideCity && t.city ? ` · ${t.city}/${t.state}` : t.state ? ` · ${t.state}` : ""}</div>
                  </div>
                </Link>
                <NoteForm targetId={t.id} initialNote={f.note} compact />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
