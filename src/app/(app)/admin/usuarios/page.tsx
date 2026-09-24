import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth";
import { adminUserAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const users = await db.user.findMany({
    where: q ? { OR: [{ nick: { contains: q } }, { email: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { wallet: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Usuários</h1>
      <form><input name="q" defaultValue={q} placeholder="nick ou e-mail" className="input max-w-sm" /></form>
      <div className="card divide-y divide-line">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <Link href={`/u/${u.nick}`} className="font-semibold">@{u.nick}</Link>
            <span className="text-xs text-mute">{u.email}</span>
            <span className="text-xs">{u.role}</span>
            <span className={`text-xs ${u.status === "ACTIVE" ? "text-green-300" : "text-red-300"}`}>{u.status}</span>
            <span className="text-xs text-mute">verif: {u.ageVerification}</span>
            <span className="text-xs text-gold">🌶️{u.wallet?.balance ?? 0}</span>
            {u.vipUntil && u.vipUntil > new Date() && <span className="rounded bg-gold px-1 text-[10px] font-bold text-ink">VIP até {u.vipUntil.toLocaleDateString("pt-BR")}</span>}
            <div className="ml-auto flex flex-wrap gap-1">
              <form action={adminUserAction.bind(null, u.id)} className="flex gap-1">
                <input type="hidden" name="op" value="coins" />
                <input type="hidden" name="idem" value={randomUUID()} />
                <input name="amount" type="number" placeholder="±moedas" className="input w-24 py-1 text-xs" />
                <input name="note" placeholder="motivo" className="input w-28 py-1 text-xs" />
                <button className="btn-ghost py-1 text-xs">Ajustar</button>
              </form>
              <form action={adminUserAction.bind(null, u.id)} className="flex gap-1">
                <input type="hidden" name="op" value="role" />
                <select name="role" defaultValue={u.role} className="input w-auto py-1 text-xs"><option>USER</option><option>MODERATOR</option><option>ADMIN</option></select>
                <button className="btn-ghost py-1 text-xs">Cargo</button>
              </form>
              <form action={adminUserAction.bind(null, u.id)} className="flex gap-1">
                <input type="hidden" name="op" value="vip" />
                <input name="days" type="number" defaultValue={30} className="input w-16 py-1 text-xs" />
                <button className="btn-ghost py-1 text-xs">+VIP</button>
              </form>
              {u.ageVerification !== "APPROVED" && <form action={adminUserAction.bind(null, u.id)}><input type="hidden" name="op" value="verify" /><button className="btn-ghost py-1 text-xs">Verificar</button></form>}
              {u.status === "ACTIVE" ? (
                <>
                  <form action={adminUserAction.bind(null, u.id)}><input type="hidden" name="op" value="suspend" /><button className="btn-ghost py-1 text-xs">Suspender</button></form>
                  <form action={adminUserAction.bind(null, u.id)}><input type="hidden" name="op" value="ban" /><button className="btn-wine py-1 text-xs">Banir</button></form>
                </>
              ) : (
                <form action={adminUserAction.bind(null, u.id)}><input type="hidden" name="op" value="unban" /><button className="btn-gold py-1 text-xs">Reativar</button></form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
