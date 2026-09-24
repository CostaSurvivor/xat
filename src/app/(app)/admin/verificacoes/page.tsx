import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES } from "@/lib/config";
import { requireStaff } from "@/server/auth";
import { reviewVerification } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Verificacoes() {
  await requireStaff();
  const list = await db.verificationRequest.findMany({ where: { status: "PENDING" }, include: { user: { include: { persons: true } } }, orderBy: { createdAt: "asc" }, take: 30 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Verificações pendentes ({list.length})</h1>
      <p className="text-sm text-mute">Confira: pessoa(s) real(is), gesto pedido, papel com o nick, <b className="text-fg">aparência claramente adulta</b> e, em casais, as duas pessoas. Em dúvida sobre idade, recuse.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((v) => (
          <div key={v.id} className="card space-y-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${v.mediaId}?v=d`} alt="selfie" className="max-h-96 w-full rounded-lg bg-black object-contain" />
            <p className="text-sm"><b>@{v.user.nick}</b> · {PROFILE_TYPES[v.user.profileType].label}</p>
            <p className="text-sm text-mute">Idades declaradas: {v.user.persons.map((p) => `${p.label} ${ageOn(p.birthDate)}`).join(", ")}</p>
            <p className="text-sm">Gesto pedido: <b className="text-gold2">{v.gesture}</b></p>
            <div className="flex flex-wrap gap-2">
              <form action={reviewVerification.bind(null, v.id, true)}><button className="btn-gold">Aprovar</button></form>
              <form action={reviewVerification.bind(null, v.id, false)} className="flex gap-2">
                <select name="reason" className="input w-auto py-1 text-xs">
                  <option>Gesto diferente do pedido</option>
                  <option>Nick não aparece no papel</option>
                  <option>Rosto não visível</option>
                  <option>Falta uma pessoa do casal</option>
                  <option>Foto parece não ser real / da internet</option>
                  <option>Não foi possível confirmar maioridade</option>
                </select>
                <button className="btn-wine">Recusar</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
