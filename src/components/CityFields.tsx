"use client";

import { useEffect, useId, useState } from "react";
import { UFS } from "@/lib/config";

/** UF + cidade com sugestões dos municípios do IBGE (o nome certo permite calcular a distância). */
export function CityFields({ defaultState = "SP", defaultCity = "", required = false }: { defaultState?: string; defaultCity?: string; required?: boolean }) {
  const [uf, setUf] = useState(defaultState);
  const [cities, setCities] = useState<string[]>([]);
  const listId = useId();
  useEffect(() => {
    let alive = true;
    fetch(`/api/public/cidades?uf=${uf}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((c: string[]) => alive && setCities(c))
      .catch(() => {});
    return () => { alive = false; };
  }, [uf]);
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <div>
        <label className="label">UF</label>
        <select name="state" value={uf} onChange={(e) => setUf(e.target.value)} className="input">{UFS.map((u) => <option key={u}>{u}</option>)}</select>
      </div>
      <div>
        <label className="label">Cidade</label>
        <input name="city" required={required} defaultValue={defaultCity} list={listId} autoComplete="off" className="input" placeholder="Comece a digitar…" />
        <datalist id={listId}>{cities.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
    </div>
  );
}
