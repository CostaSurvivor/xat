import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CURRENCY_NAME } from "@/lib/config";
import { LIVE } from "@/lib/live";
import { ActionForm } from "@/components/Forms";
import { startLiveAction } from "@/app/actions/live";
import { requireUser } from "@/server/auth";
import { canBroadcast } from "@/server/live";

export const metadata = { title: "Transmitir ao vivo" };

export default async function NovaLive() {
  const user = await requireUser();
  const open = await db.liveStream.findFirst({ where: { hostId: user.id, status: "LIVE" }, select: { id: true } });
  if (open) redirect(`/ao-vivo/${open.id}`);
  const denied = canBroadcast(user);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/ao-vivo" className="text-sm text-mute hover:text-white">← Ao vivo</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🎥 Transmitir ao vivo</h1>
      {denied ? (
        <div className="card p-5">
          <p>{denied}</p>
          <Link href="/verificacao" className="btn-gold mt-3">Verificar agora</Link>
        </div>
      ) : (
        <ActionForm action={startLiveAction} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="title">Título</label>
            <input id="title" name="title" required minLength={3} maxLength={80} className="input" placeholder="Ex.: Papo quente de sexta 🔥" />
          </div>
          <div>
            <label className="label" htmlFor="audience">Quem pode assistir</label>
            <select id="audience" name="audience" className="input">
              <option value="ALL">Todos os membros logados</option>
              <option value="VIP">Só assinantes 💎</option>
            </select>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <div>
              <label className="label" htmlFor="tipGoal">Meta ({CURRENCY_NAME})</label>
              <input id="tipGoal" name="tipGoal" type="number" min={10} className="input" placeholder="opcional" />
            </div>
            <div>
              <label className="label" htmlFor="goalLabel">O que acontece na meta</label>
              <input id="goalLabel" name="goalLabel" maxLength={60} className="input" placeholder="opcional" />
            </div>
          </div>
          <div className="rounded-xl border border-gold/30 bg-panel2 p-3 text-xs text-mute">
            <p className="mb-1 font-semibold text-gold">Regras do ao vivo</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Só pessoas maiores de 18 anos, verificadas e que <b>consentiram</b> podem aparecer.</li>
              <li>Proibido transmitir em local público, terceiros sem consentimento, violência, drogas ou qualquer conteúdo ilegal.</li>
              <li>Qualquer suspeita de menor de idade encerra a transmissão e é denunciada às autoridades.</li>
              <li>O vídeo sai direto do seu aparelho para até {LIVE.maxViewers} pessoas por vez (as demais ficam no chat). Use Wi-Fi e mantenha a aba aberta.</li>
              <li>A moderação pode encerrar a transmissão a qualquer momento. Não gravamos o vídeo.</li>
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="rules" required className="mt-1" />
            <span>Li e aceito as regras. Todos que aparecem são maiores de 18 e concordaram em aparecer.</span>
          </label>
          <button className="btn-gold w-full">🔴 Começar transmissão</button>
        </ActionForm>
      )}
    </div>
  );
}
