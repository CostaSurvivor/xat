"use client";

import { useActionState, useState } from "react";
import { saveItem } from "@/app/actions/admin";

const EXAMPLES: Record<string, string> = {
  GLOW: '{"colors":["#d4af37","#f1d77a"],"animation":"pulse"}',
  NICK_COLOR: '{"colors":["#ff512f","#f09819"]}',
  TEXT_COLOR: '{"color":"#f1d77a"}',
  BADGE: '{"emoji":"👑"}',
  AVATAR_FRAME: '{"colors":["#d4af37"],"animation":"none"}',
  ENTRY_EFFECT: '{"effect":"fire"}',
  POWER: '{"power":"HIGHLIGHT_ONLINE"}',
};

export function ItemEditor() {
  const [state, action, pending] = useActionState(saveItem, undefined);
  const [cat, setCat] = useState("GLOW");
  const [cfg, setCfg] = useState(EXAMPLES.GLOW);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-4">
      <input name="slug" required placeholder="slug-unico" className="input" />
      <input name="name" required placeholder="Nome" className="input" />
      <select name="category" value={cat} onChange={(e) => { setCat(e.target.value); setCfg(EXAMPLES[e.target.value]); }} className="input">
        {Object.keys(EXAMPLES).map((c) => <option key={c}>{c}</option>)}
      </select>
      <select name="rarity" className="input"><option>COMMON</option><option>RARE</option><option>EPIC</option><option>LEGENDARY</option><option>LIMITED</option></select>
      <input name="description" placeholder="Descrição" className="input sm:col-span-4" />
      <textarea name="config" value={cfg} onChange={(e) => setCfg(e.target.value)} className="input font-mono text-xs sm:col-span-4" />
      <input name="price7" type="number" placeholder="preço 7d" className="input" />
      <input name="price30" type="number" placeholder="preço 30d" className="input" />
      <input name="pricePerm" type="number" placeholder="preço permanente" className="input" />
      <input name="limitedQty" type="number" placeholder="qtd limitada" className="input" />
      <input name="powerScore" type="number" defaultValue={5} placeholder="poder" className="input" />
      <button disabled={pending} className="btn-gold sm:col-span-3">Salvar item (cria ou atualiza pelo slug)</button>
      {state?.error && <p className="text-sm text-red-300 sm:col-span-4">{state.error}</p>}
      {state?.ok && <p className="text-sm text-gold sm:col-span-4">Item salvo!</p>}
      <p className="text-xs text-mute sm:col-span-4">O visual é gerado a partir desse JSON validado: só cores #hex e animações da lista (none, pulse, rainbow, shift, flicker). Não é possível injetar CSS.</p>
    </form>
  );
}
