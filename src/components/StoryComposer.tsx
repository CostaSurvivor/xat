"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postStory } from "@/app/actions/stories";
import { STORIES } from "@/lib/stories";

export function StoryComposer({ nick }: { nick: string }) {
  const [state, action, pending] = useActionState(postStory, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.push(`/stories/${nick}`);
  }, [state, nick, router]);
  return (
    <form action={action} className="card space-y-3 p-4">
      <label className="flex aspect-[9/16] max-h-[60vh] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-panel2 text-center text-sm text-mute">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <span>📷<br />Toque para escolher a foto</span>
        )}
        <input type="file" name="photo" required accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
      </label>
      <input name="caption" maxLength={STORIES.captionMax} className="input" placeholder="Legenda (opcional)" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="audience" className="input w-auto py-1.5 text-sm">
          <option value="ALL">🌎 Todos</option>
          <option value="FRIENDS">🤝 Só amigos</option>
        </select>
        <span className="flex-1 text-xs text-mute">Some em {STORIES.ttlHours} h. Você vê quem viu.</span>
        <button disabled={pending} className="btn-gold">{pending ? "Publicando…" : "Publicar story"}</button>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <p className="text-[11px] text-mute">Só publique fotos suas ou com consentimento de todos que aparecem. A foto recebe marca d’água com seu nick.</p>
    </form>
  );
}
