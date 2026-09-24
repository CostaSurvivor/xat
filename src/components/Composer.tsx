"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPost } from "@/app/actions/posts";

export function Composer({ verified }: { verified: boolean }) {
  const [state, action, pending] = useActionState(createPost, undefined);
  const [previews, setPreviews] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPreviews([]);
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="card space-y-3 p-4">
      <textarea name="body" maxLength={3000} placeholder="O que vocês estão a fim hoje? 😈" className="input h-20 resize-none" />
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previews.map((p) => <img key={p} src={p} alt="" className="h-20 w-20 rounded-lg object-cover" />)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {verified ? (
          <label className="btn-ghost cursor-pointer">
            📷 Fotos
            <input
              type="file"
              name="photos"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => setPreviews(Array.from(e.target.files ?? []).slice(0, 6).map((f) => URL.createObjectURL(f)))}
            />
          </label>
        ) : (
          <a href="/verificacao" className="text-xs text-mute underline">Verifique-se para postar fotos</a>
        )}
        <select name="visibility" className="input w-auto py-1.5 text-xs">
          <option value="PUBLIC">Todos</option>
          <option value="FOLLOWERS">Só quem me segue</option>
        </select>
        <div className="flex-1" />
        <button disabled={pending} className="btn-gold">{pending ? "Publicando…" : "Publicar"}</button>
      </div>
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      <p className="text-[11px] text-mute">Só publique fotos suas ou com consentimento de todos que aparecem. Toda foto recebe marca d’água com seu nick.</p>
    </form>
  );
}
