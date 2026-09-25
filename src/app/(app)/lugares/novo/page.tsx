import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import Link from "next/link";
import { UFS, UF_NAMES } from "@/lib/config";
import { PLACE_KINDS, PLACES } from "@/lib/places";
import { ActionForm } from "@/components/Forms";
import { suggestPlace } from "@/app/actions/places";
import { isVerified, requireUser } from "@/server/auth";

export const metadata = { title: "Sugerir lugar" };

export default async function NovoLugar() {
  if (!FEATURES.lugares) notFound();
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/lugares" className="text-sm text-mute hover:text-fg">← Lugares</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">📍 Sugerir lugar</h1>
      {!isVerified(user) ? (
        <div className="card p-5">
          <p>Verifique seu perfil (selfie) para sugerir lugares.</p>
          <Link href="/verificacao" className="btn-gold mt-3">Verificar</Link>
        </div>
      ) : (
        <ActionForm action={suggestPlace} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="name">Nome do lugar</label>
            <input id="name" name="name" required minLength={3} maxLength={80} className="input" placeholder="Ex.: Clube Sensações" />
          </div>
          <div>
            <label className="label" htmlFor="kind">Tipo</label>
            <select id="kind" name="kind" required className="input">
              {Object.entries(PLACE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div>
              <label className="label" htmlFor="state">Estado</label>
              <select id="state" name="state" required defaultValue={user.state ?? ""} className="input">
                <option value="">UF</option>
                {UFS.map((u) => <option key={u} value={u} title={UF_NAMES[u]}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="city">Cidade</label>
              <input id="city" name="city" required maxLength={80} defaultValue={user.city ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address">Endereço ou bairro (opcional)</label>
            <input id="address" name="address" maxLength={160} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="site">Site ou Instagram (opcional)</label>
            <input id="site" name="site" maxLength={120} className="input" placeholder="www.exemplo.com.br" />
          </div>
          <div>
            <label className="label" htmlFor="description">Como é o lugar? (opcional)</label>
            <textarea id="description" name="description" rows={4} maxLength={PLACES.descMax} className="input" placeholder="Público, dias com mais movimento, dress code…" />
          </div>
          <p className="text-xs text-mute">A equipe confere antes de publicar. Até {PLACES.suggestPerDay} sugestões por dia.</p>
          <button className="btn-gold">Enviar sugestão</button>
        </ActionForm>
      )}
    </div>
  );
}
