import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES } from "@/lib/config";
import { requireStaff } from "@/server/auth";
import { reviewVerification } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Verificacoes() {
  await requireStaff();
  const list = await db.verificationRequest.findMany({ where: { status: "PENDING" }, include: { user: { include: { persons: true } } }, orderBy: { createdAt: "asc" }, take: 30 });
  // alertas para quem aprova: mesma foto já usada por outra conta e quem convidou (convite entre contas da mesma pessoa)
  const medias = await db.media.findMany({ where: { id: { in: list.map((v) => v.mediaId) } }, select: { id: true, sha256: true } });
  const shaOf = new Map(medias.map((m) => [m.id, m.sha256]));
  const twins = await db.media.findMany({
    where: { sha256: { in: medias.map((m) => m.sha256) }, kind: "VERIFICATION_SELFIE" },
    select: { sha256: true, ownerId: true, owner: { select: { nick: true } } },
  });
  const inviters = await db.user.findMany({ where: { id: { in: list.map((v) => v.user.referredById).filter((x): x is string => !!x) } }, select: { id: true, nick: true } });
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
            {(() => {
              const dup = twins.filter((t) => t.sha256 === shaOf.get(v.mediaId) && t.ownerId !== v.userId);
              return dup.length > 0 && <p className="rounded-lg bg-red-100 p-2 text-sm font-semibold text-red-800" data-testid="selfie-repetida">⚠️ Mesma foto já enviada por {dup.map((d) => `@${d.owner.nick}`).join(", ")}. Provável conta falsa.</p>;
            })()}
            {v.user.referredById && <p className="text-xs text-mute">📣 Entrou pelo convite de <b>@{inviters.find((i) => i.id === v.user.referredById)?.nick ?? "?"}</b>. Se parecer a mesma pessoa, recuse.</p>}
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
