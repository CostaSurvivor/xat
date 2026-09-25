"use client";

import { useState, useTransition } from "react";
import { deleteConto, toggleContoLike } from "@/app/actions/contos";

export function ContoLikeButton({ id, liked, count, disabled }: { id: string; liked: boolean; count: number; disabled?: boolean }) {
  const [s, setS] = useState({ liked, count });
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      aria-pressed={s.liked}
      title={disabled ? "Você não pode curtir o próprio conto" : s.liked ? "Descurtir" : "Curtir"}
      onClick={() => start(async () => { const r = await toggleContoLike(id); if (r) setS(r); })}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${s.liked ? "border-wine bg-wine text-white" : "border-line hover:border-wine hover:text-wine"} disabled:opacity-60`}
    >
      {s.liked ? "❤" : "♡"} {s.count} {s.count === 1 ? "curtida" : "curtidas"}
    </button>
  );
}

export function ContoDeleteButton({ id, staff }: { id: string; staff: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm(staff ? "Remover este conto (moderação)?" : "Apagar seu conto? Não dá para desfazer.") && start(() => deleteConto(id))}
      className="text-xs text-mute hover:text-red-700"
    >
      🗑 {staff ? "Remover (moderação)" : "Apagar"}
    </button>
  );
}
