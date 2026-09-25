"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { queueAct } from "@/app/actions/modqueue";
import { REJECT_REASONS, SHORTCUTS, type QueueKind } from "@/lib/modqueue";

export type QueueItem = {
  kind: QueueKind;
  id: string;
  priority: number;
  createdAt: string;
  title: string;
  lines: string[];
  images: { id: string; blur: boolean }[];
  /** áudio do PV denunciado (ouvir antes de decidir) */
  audios?: string[];
  link: string | null;
  urgent?: boolean;
};

const KIND_LABEL: Record<QueueKind, string> = { verification: "✅ Verificação", event: "🎉 Evento", report: "🚩 Denúncia" };

/** Fila única com atalhos: um item por vez, ação sem recarregar a página. */
export function ModQueue({ items: initial }: { items: QueueItem[] }) {
  const [items, setItems] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cur = items[Math.min(idx, items.length - 1)];

  const act = useCallback(
    (op: string, label: string, danger?: boolean) => {
      if (!cur || pending) return;
      if ((danger || op === "escalate") && !confirm(`${label}: confirmar?`)) return;
      start(async () => {
        const r = await queueAct(cur.kind, cur.id, op, cur.kind === "verification" && op === "reject" ? reason : note || undefined);
        if (!r.ok) return setMsg(r.error ?? "Erro");
        setMsg(`${label} ✓`);
        setDone((d) => d + 1);
        setNote("");
        setItems((list) => list.filter((i) => i.id !== cur.id));
      });
    },
    [cur, pending, note, reason],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !cur) return;
      const k = e.key.toLowerCase();
      if (k === "j") return setIdx((i) => Math.min(i + 1, items.length - 1));
      if (k === "k") return setIdx((i) => Math.max(i - 1, 0));
      if (cur.kind === "verification" && /^[1-6]$/.test(k)) return setReason(REJECT_REASONS[Number(k) - 1]);
      const s = SHORTCUTS[cur.kind][k];
      if (s) { e.preventDefault(); act(s.op, s.label, s.danger); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, items.length, act]);

  const counts = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">⚡ Fila rápida</h1>
        <span className="text-sm text-mute">{items.length} na fila · {done} resolvidos agora</span>
        {(Object.keys(KIND_LABEL) as QueueKind[]).map((k) => <span key={k} className="rounded-full border border-line px-2 py-0.5 text-xs">{KIND_LABEL[k]} {counts[k] ?? 0}</span>)}
      </div>
      <p className="text-xs text-mute">
        Atalhos: <kbd>J</kbd>/<kbd>K</kbd> próximo/anterior · verificação e evento: <kbd>A</kbd> aprovar, <kbd>R</kbd> recusar (<kbd>1</kbd>–<kbd>6</kbd> escolhem o motivo) · denúncia: <kbd>I</kbd> improcedente, <kbd>D</kbd> remover, <kbd>S</kbd> remover + suspender, <kbd>B</kbd> remover + banir. <b>Escalar (crime) só pelo botão.</b>
      </p>
      {msg && <p className="text-sm text-gold" aria-live="polite">{msg}</p>}

      {!cur ? (
        <p className="card p-10 text-center text-mute">🎉 Fila vazia. Nada para moderar agora.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <article className={`card space-y-3 p-4 ${cur.urgent ? "border-red-500/70" : ""}`} aria-busy={pending}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-panel2 px-2 py-0.5 text-xs">{KIND_LABEL[cur.kind]}</span>
              <b className={cur.urgent ? "text-red-700" : ""}>{cur.title}</b>
              <span className="ml-auto text-xs text-mute">{Math.min(idx, items.length - 1) + 1} de {items.length}</span>
            </div>
            {cur.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cur.images.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={`/api/media/${m.id}?v=${m.blur ? "b" : "d"}`} alt="" className="max-h-96 max-w-full rounded-lg bg-black object-contain" />
                ))}
              </div>
            )}
            {cur.audios?.map((id) => <audio key={id} controls preload="none" src={`/api/media/${id}`} className="w-full" data-testid="fila-audio" />)}
            {cur.lines.map((l, i) => <p key={i} className="whitespace-pre-wrap break-words text-sm">{l}</p>)}
            {cur.link && <Link href={cur.link} target="_blank" className="text-xs text-gold underline">Abrir em nova aba ↗</Link>}

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {cur.kind === "verification" ? (
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="input w-auto py-1 text-xs" aria-label="Motivo da recusa">
                  {REJECT_REASONS.map((r, i) => <option key={r} value={r}>{i + 1}. {r}</option>)}
                </select>
              ) : (
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota / protocolo (opcional)" className="input w-56 py-1 text-xs" />
              )}
              {Object.entries(SHORTCUTS[cur.kind]).map(([k, s]) => (
                <button key={k} disabled={pending} onClick={() => act(s.op, s.label, s.danger)} className={`${s.op === "approve" ? "btn-gold" : s.danger || s.op === "reject" ? "btn-wine" : "btn-ghost"} py-1 text-xs`}>
                  {s.label} <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px] uppercase">{k}</kbd>
                </button>
              ))}
              {cur.kind === "report" && (
                <button disabled={pending} onClick={() => act("escalate", "Escalar (crime)")} className="btn rounded-full bg-red-700 py-1 text-xs text-white">🚨 Escalar (crime)</button>
              )}
            </div>
          </article>

          <ol className="card max-h-[70vh] space-y-1 overflow-y-auto p-2 text-xs">
            {items.map((i, n) => (
              <li key={i.id}>
                <button onClick={() => setIdx(n)} className={`w-full truncate rounded-lg px-2 py-1.5 text-left ${n === Math.min(idx, items.length - 1) ? "bg-wine2 text-white" : i.urgent ? "text-red-700" : "hover:bg-panel2"}`}>
                  {KIND_LABEL[i.kind].split(" ")[0]} {i.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
