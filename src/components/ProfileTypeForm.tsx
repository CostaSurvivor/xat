"use client";

import { useActionState, useState } from "react";
import { updateProfileType } from "@/app/actions/profile";
import { PROFILE_TYPES, type ProfileTypeKey } from "@/lib/config";

export function ProfileTypeForm({ current, births }: { current: ProfileTypeKey; births: string[] }) {
  const [state, action, pending] = useActionState(updateProfileType, undefined);
  const [type, setType] = useState<ProfileTypeKey>(current);
  const persons = PROFILE_TYPES[type].persons;
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(PROFILE_TYPES) as ProfileTypeKey[]).map((k) => (
          <label key={k} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm ${type === k ? "border-gold bg-wine text-white" : "border-line text-mute"}`}>
            <input type="radio" name="profileType" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
            {PROFILE_TYPES[k].label}
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {persons.map((p, i) => (
          <label key={`${type}-${i}`} className="text-xs text-mute">
            Nascimento: {p}
            <input type="date" name={`birth${i}`} required defaultValue={births[i] ?? ""} className="input mt-0.5" />
          </label>
        ))}
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-gold">Tipo de perfil atualizado!</p>}
      <button disabled={pending} className="btn-gold">Salvar tipo de perfil</button>
    </form>
  );
}
