"use client";

import { useActionState, useState } from "react";
import { saveConto } from "@/app/actions/contos";
import { CONTOS, CONTO_CATEGORIES } from "@/lib/contos";

type Initial = { id: string; title: string; category: string; body: string } | null;

export function ContoForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(saveConto.bind(null, initial?.id ?? null), undefined);
  // campos controlados: o React limpa o formulário depois da ação, e um erro não pode apagar o texto escrito
  const [f, setF] = useState({ title: initial?.title ?? "", category: initial?.category ?? "", body: initial?.body ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const len = f.body.trim().length;
  return (
    <form action={action} className="card space-y-4 p-5">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Título</span>
        <input name="title" required minLength={CONTOS.titleMin} maxLength={CONTOS.titleMax} value={f.title} onChange={set("title")} className="input w-full" placeholder="Ex.: Nossa primeira vez numa casa de swing" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Categoria</span>
        <select name="category" required value={f.category} onChange={set("category")} className="input w-full">
          <option value="" disabled>Escolha…</option>
          {Object.entries(CONTO_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between text-sm font-medium">
          <span>Conto</span>
          <span className={`text-xs ${len < CONTOS.bodyMin || len > CONTOS.bodyMax ? "text-red-700" : "text-mute"}`}>{len.toLocaleString("pt-BR")} / mín. {CONTOS.bodyMin} caracteres</span>
        </span>
        <textarea name="body" required rows={18} maxLength={CONTOS.bodyMax} value={f.body} onChange={set("body")} className="input w-full leading-relaxed" placeholder="Conte como foi… Deixe uma linha em branco entre os parágrafos." />
      </label>
      <p className="text-xs text-mute">Regras: só adultos e sempre com consentimento, mesmo na ficção. Nada de menores, incesto, violência sexual, zoofilia, links ou contatos. Não exponha nomes reais nem dados de terceiros.</p>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn-gold" disabled={pending}>{pending ? "Salvando…" : initial ? "Salvar alterações" : "Publicar conto"}</button>
      </div>
    </form>
  );
}
