"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPost } from "@/app/actions/posts";

/** Captura um quadro do vídeo no navegador para servir de capa (sem ffmpeg no servidor). */
async function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(file);
    const done = (b: Blob | null) => { URL.revokeObjectURL(v.src); resolve(b); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      c.toBlob((b) => done(b), "image/jpeg", 0.85);
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
  });
}

export function Composer({ verified }: { verified: boolean }) {
  const [state, action, pending] = useActionState(createPost, undefined);
  const [previews, setPreviews] = useState<string[]>([]);
  const [poster, setPoster] = useState<Blob | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPreviews([]);
      setPoster(null);
      setVideoName(null);
    }
  }, [state]);
  return (
    <form
      ref={formRef}
      action={(fd) => {
        if (poster) fd.set("poster", new File([poster], "poster.jpg", { type: "image/jpeg" }));
        return action(fd);
      }}
      className="card space-y-3 p-4"
    >
      <textarea name="body" maxLength={3000} placeholder="O que vocês estão a fim hoje? 😈" className="input h-20 resize-none" />
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previews.map((p) => <img key={p} src={p} alt="" className="h-20 w-20 rounded-lg object-cover" />)}
        </div>
      )}
      {videoName && <p className="text-xs text-gold">🎬 {videoName} (só assinantes vão assistir)</p>}
      <div className="flex flex-wrap items-center gap-2">
        {verified ? (
          <>
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
            <label className="btn-ghost cursor-pointer">
              🎬 Vídeo
              <input
                type="file"
                name="video"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  setVideoName(f?.name ?? null);
                  setPoster(f ? await capturePoster(f) : null);
                }}
              />
            </label>
          </>
        ) : (
          <a href="/verificacao" className="text-xs text-mute underline">Verifique-se para postar fotos e vídeos</a>
        )}
        <select name="visibility" className="input w-auto py-1.5 text-xs">
          <option value="PUBLIC">Todos</option>
          <option value="FOLLOWERS">Só quem me segue</option>
        </select>
        <div className="flex-1" />
        <button disabled={pending} className="btn-gold">{pending ? "Publicando…" : "Publicar"}</button>
      </div>
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      <p className="text-[11px] text-mute">Só publique fotos e vídeos seus ou com consentimento de todos que aparecem. Toda mídia recebe marca d’água com seu nick.</p>
    </form>
  );
}
