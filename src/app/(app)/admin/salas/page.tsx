import Link from "next/link";
import { db } from "@/lib/db";
import { STAFF_ONLY_ROOMS } from "@/lib/config";
import { requireStaff } from "@/server/auth";
import { adminRoomModerator } from "@/app/actions/admin";
import { roomOnlineCounts } from "@/server/rooms";
import { ActionForm } from "@/components/Forms";

export const dynamic = "force-dynamic";

export default async function AdminSalas() {
  await requireStaff();
  const [rooms, counts, mods] = await Promise.all([
    db.room.findMany({ include: { _count: { select: { members: true, messages: true } } } }),
    roomOnlineCounts(),
    db.roomMember.findMany({ where: { role: "MODERATOR" }, include: { user: { select: { nick: true } } } }),
  ]);
  const modsOf = new Map<string, string[]>();
  for (const m of mods) modsOf.set(m.roomId, [...(modsOf.get(m.roomId) ?? []), m.user.nick]);
  const main = rooms.filter((r) => STAFF_ONLY_ROOMS.has(r.slug)).sort((a) => (a.slug === "geral" ? -1 : 1));
  const states = rooms.filter((r) => !STAFF_ONLY_ROOMS.has(r.slug)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const semMod = states.filter((r) => !modsOf.get(r.id)?.length).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Salas e moderadores</h1>
        <p className="text-sm text-mute">
          Admins e moderadores do site moderam todas as salas. Nas salas de estado, escolha usuários para moderar. {semMod > 0 && <b className="text-wine2">{semMod} sala(s) de estado sem moderador.</b>}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">Salas principais (só equipe do site)</h2>
        {main.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
            <Link href={`/${r.slug}`} className="font-semibold hover:underline">{r.name}</Link>
            <span className="text-xs text-mute">/{r.slug} · {r._count.members} membros · {r._count.messages} msgs · {counts.get(r.id) ?? 0} on{r.access === "COUPLES_ONLY" && " · 💑 só perfis de casal"}</span>
            <span className="ml-auto rounded-full bg-panel2 px-2 py-0.5 text-xs text-mute">🛡️ moderação: equipe do site</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">Estados</h2>
        <div className="grid gap-2 lg:grid-cols-2">
          {states.map((r) => {
            const list = modsOf.get(r.id) ?? [];
            return (
              <div key={r.id} className="card space-y-2 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-8 rounded bg-panel2 py-0.5 text-center text-xs font-bold text-gold">{r.state ?? r.slug.toUpperCase()}</span>
                  <Link href={`/${r.slug}`} className="font-semibold hover:underline">{r.name}</Link>
                  <span className="ml-auto text-xs text-mute">{counts.get(r.id) ?? 0} on · {r._count.messages} msgs</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {list.length === 0 && <span className="text-xs text-mute">Sem moderador</span>}
                  {list.map((nick) => (
                    <ActionForm key={nick} action={adminRoomModerator.bind(null, r.id)} className="inline" okText="">
                      <input type="hidden" name="op" value="remove" />
                      <input type="hidden" name="nick" value={nick} />
                      <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs">
                        🛡️ @{nick}
                        <button className="text-mute hover:text-wine2" title="Remover moderador">✕</button>
                      </span>
                    </ActionForm>
                  ))}
                </div>
                <ActionForm action={adminRoomModerator.bind(null, r.id)} className="flex gap-1.5" okText="Moderador definido!" resetOnOk>
                  <input type="hidden" name="op" value="add" />
                  <input name="nick" required placeholder="nick do novo moderador" className="input py-1.5 text-xs" />
                  <button className="btn-ghost shrink-0 py-1 text-xs">+ Moderador</button>
                </ActionForm>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
