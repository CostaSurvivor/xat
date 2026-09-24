import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/Forms";
import { adminCreateGroup, adminGroupAction } from "@/app/actions/groups";
import { requireStaff } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminGrupos() {
  await requireStaff();
  const groups = await db.group.findMany({ orderBy: [{ archivedAt: "asc" }, { name: "asc" }], include: { _count: { select: { members: true, posts: true } } } });
  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <h1 className="text-xl font-bold">Criar grupo</h1>
        <p className="text-sm text-mute">Só a equipe do site cria grupos. Usuários participam e postam dentro deles.</p>
        <ActionForm action={adminCreateGroup} className="grid gap-2 sm:grid-cols-2" okText="Grupo criado!" resetOnOk>
          <input name="name" required maxLength={60} placeholder="Nome (ex.: Casais de Campinas)" className="input" />
          <input name="slug" required pattern="[a-z0-9][a-z0-9-]{2,39}" placeholder="endereço (ex.: casais-campinas)" className="input" />
          <input name="emoji" required maxLength={8} defaultValue="💬" className="input" />
          <select name="audience" className="input">
            <option value="ALL">Todos os perfis</option>
            <option value="COUPLES">Só casais 💑</option>
          </select>
          <textarea name="description" required minLength={10} maxLength={2000} placeholder="Descrição e regras do grupo" className="input h-24 sm:col-span-2" />
          <button className="btn-gold sm:col-span-2 sm:justify-self-start">Criar grupo</button>
        </ActionForm>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Grupos ({groups.length})</h2>
        {groups.map((g) => (
          <details key={g.id} className={`card p-3 text-sm ${g.archivedAt ? "opacity-60" : ""}`}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="text-lg">{g.emoji}</span>
              <Link href={`/grupos/${g.slug}`} className="font-semibold hover:underline">{g.name}</Link>
              <span className="text-xs text-mute">/grupos/{g.slug} · {g._count.members} membros · {g._count.posts} posts{g.audience === "COUPLES" && " · só casais"}{g.archivedAt && " · ARQUIVADO"}</span>
            </summary>
            <form action={adminGroupAction.bind(null, g.id)} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="op" value="edit" />
              <input name="name" defaultValue={g.name} maxLength={60} className="input" />
              <input name="emoji" defaultValue={g.emoji} maxLength={8} className="input" />
              <select name="audience" defaultValue={g.audience} className="input">
                <option value="ALL">Todos os perfis</option>
                <option value="COUPLES">Só casais 💑</option>
              </select>
              <textarea name="description" defaultValue={g.description} maxLength={2000} className="input h-20 sm:col-span-2" />
              <button className="btn-ghost sm:justify-self-start">Salvar</button>
            </form>
            <form action={adminGroupAction.bind(null, g.id)} className="mt-2">
              <input type="hidden" name="op" value={g.archivedAt ? "unarchive" : "archive"} />
              <button className="text-xs text-red-700 hover:underline">{g.archivedAt ? "Reativar grupo" : "Arquivar grupo (some para os usuários)"}</button>
            </form>
          </details>
        ))}
      </section>
    </div>
  );
}
