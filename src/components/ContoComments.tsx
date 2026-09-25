"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { addContoComment, deleteContoComment } from "@/app/actions/contos";
import { CONTOS } from "@/lib/contos";
import { timeAgo } from "@/lib/time";
import { ReportButton } from "./ReportButton";

type C = { id: string; body: string; createdAt: string; author: { nick: string }; mine: boolean; canDelete: boolean };

export function ContoComments({ contoId, comments, canComment }: { contoId: string; comments: C[]; canComment: boolean }) {
  const [state, action, pending] = useActionState(addContoComment.bind(null, contoId), undefined);
  // controlado: um erro não apaga o que foi escrito; depois de publicar, limpa
  const [body, setBody] = useState("");
  const [lastOk, setLastOk] = useState(0);
  if (state?.ok && state.n !== lastOk) { setLastOk(state.n ?? 0); setBody(""); }
  return (
    <section className="card p-5" aria-label="Comentários">
      <h2 className="mb-3 font-semibold">💬 Comentários ({comments.length})</h2>
      {comments.length === 0 && <p className="mb-3 text-sm text-mute">Ninguém comentou ainda. Diga o que achou!</p>}
      <ul className="space-y-3" data-testid="comentarios">
        {comments.map((c) => <Comment key={c.id} c={c} />)}
      </ul>
      {canComment && (
        <form action={action} className="mt-4 space-y-2">
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={CONTOS.commentMax} required className="input w-full" placeholder="Escreva um comentário respeitoso…" aria-label="Seu comentário" />
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end"><button className="btn-wine" disabled={pending || !body.trim()}>{pending ? "Enviando…" : "Comentar"}</button></div>
        </form>
      )}
    </section>
  );
}

function Comment({ c }: { c: C }) {
  const [pending, start] = useTransition();
  return (
    <li className="rounded-xl bg-black/[0.03] p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-mute">
        <Link href={`/u/${encodeURIComponent(c.author.nick)}`} className="font-semibold text-fg hover:text-wine">@{c.author.nick}</Link>
        <span>· {timeAgo(c.createdAt)}</span>
        <span className="ml-auto flex items-center gap-3">
          {c.canDelete && <button type="button" disabled={pending} onClick={() => start(() => deleteContoComment(c.id))} className="hover:text-red-700">apagar</button>}
          {!c.mine && <ReportButton targetType="CONTO_COMMENT" targetId={c.id} label="" />}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm">{c.body}</p>
    </li>
  );
}
