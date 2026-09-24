import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { randomGesture, submitVerification } from "@/app/actions/profile";
import { ActionForm } from "@/components/Forms";
import { isCouple } from "@/lib/config";

export const metadata = { title: "Verificação" };

export default async function Verificacao({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const user = await requireUser();
  const { novo } = await searchParams;
  if (user.ageVerification === "APPROVED") redirect("/feed");
  const last = await db.verificationRequest.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const gesture = await randomGesture();
  return (
    <div className="card mx-auto max-w-lg space-y-4 p-6">
      {novo && <p className="rounded-xl bg-gold/10 p-3 text-sm text-gold2">Conta criada! 🎉 Falta só um passo para liberar tudo.</p>}
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Verificação de perfil</h1>
      {user.ageVerification === "PENDING" ? (
        <p className="text-mute">⏳ Sua selfie está em análise pela moderação. Normalmente leva poucas horas. Enquanto isso, você já pode conversar nas salas.</p>
      ) : (
        <>
          {last?.status === "REJECTED" && <p className="rounded-xl bg-wine/40 p-3 text-sm">Sua última verificação foi recusada{last.rejectReason ? `: ${last.rejectReason}` : ""}. Tente novamente.</p>}
          <p className="text-sm text-mute">
            A verificação confirma que {isCouple(user.profileType) ? "vocês dois são maiores de 18 anos e reais" : "você é maior de 18 anos e real"}. Ela libera: postar e ver fotos,
            foto de perfil, álbum privado, fotos no PV, criar salas e a loja. A selfie é vista <b className="text-white">apenas pela moderação</b> e nunca aparece no perfil.
          </p>
          <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-mute">Tire uma selfie fazendo este gesto</p>
            <p className="mt-1 text-lg font-semibold text-gold2">{gesture}</p>
            <p className="mt-1 text-xs text-mute">e segurando um papel escrito <b className="text-white">@{user.nick}</b>{isCouple(user.profileType) && ". Os dois precisam aparecer"}.</p>
          </div>
          <ActionForm action={submitVerification} className="space-y-3">
            <input type="hidden" name="gesture" value={gesture} />
            <input type="file" name="selfie" accept="image/*" capture="user" required className="input" />
            <button className="btn-gold w-full">Enviar para análise</button>
          </ActionForm>
        </>
      )}
    </div>
  );
}
