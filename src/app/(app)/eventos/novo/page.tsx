import Link from "next/link";
import { UFS, UF_NAMES } from "@/lib/config";
import { canCreateEvent } from "@/lib/events";
import { ActionForm } from "@/components/Forms";
import { createEvent } from "@/app/actions/events";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Divulgar evento" };

export default async function NovoEvento() {
  const user = await requireUser();
  const denied = canCreateEvent(user);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/eventos" className="text-sm text-mute hover:text-fg">← Eventos</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">🎉 Divulgar evento</h1>
      {denied ? (
        <div className="card p-5">
          <p>{denied}</p>
          <Link href={denied.includes("assinantes") ? "/assinar" : "/verificacao"} className="btn-gold mt-3">Continuar</Link>
        </div>
      ) : (
        <ActionForm action={createEvent} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="title">Nome do evento</label>
            <input id="title" name="title" required minLength={5} maxLength={90} className="input" placeholder="Ex.: Noite do Baile de Máscaras" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startsAt">Começa (horário de Brasília)</label>
              <input id="startsAt" name="startsAt" type="datetime-local" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="endsAt">Termina (opcional)</label>
              <input id="endsAt" name="endsAt" type="datetime-local" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div>
              <label className="label" htmlFor="state">Estado</label>
              <select id="state" name="state" defaultValue={user.state ?? "SP"} className="input">{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="city">Cidade</label>
              <input id="city" name="city" required defaultValue={user.city ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="venue">Local</label>
            <input id="venue" name="venue" required maxLength={120} className="input" placeholder="Nome da casa/clube (o endereço completo você passa no PV, se preferir)" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="priceText">Valor (opcional)</label>
              <input id="priceText" name="priceText" maxLength={80} className="input" placeholder="Ex.: R$ 120 o casal" />
            </div>
            <div>
              <label className="label" htmlFor="audience">Quem pode ir</label>
              <select id="audience" name="audience" className="input">
                <option value="ALL">Todos os perfis</option>
                <option value="COUPLES">Só casais 💑</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">Descrição</label>
            <textarea id="description" name="description" required minLength={20} maxLength={4000} className="input h-36" placeholder="Programação, dress code, regras da casa…" />
          </div>
          <div>
            <label className="label" htmlFor="cover">Capa (opcional)</label>
            <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
            <p className="mt-1 text-xs text-mute">Use uma arte ou foto do local. Nada de nudez explícita na capa.</p>
          </div>
          <p className="rounded-xl bg-panel2 p-3 text-xs text-mute">
            {user.role === "USER" ? "Seu evento fica em análise e aparece para todos assim que a equipe aprovar (você recebe um aviso)." : "Eventos da equipe do site são publicados na hora."} Somente eventos para maiores de 18 anos, em locais privados e com consentimento de todos.
          </p>
          <button className="btn-gold w-full">{user.role === "USER" ? "Enviar para aprovação" : "Publicar evento"}</button>
        </ActionForm>
      )}
    </div>
  );
}
