"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteStory, markStoryViewed, storyViewersAction } from "@/app/actions/stories";
import { STORIES } from "@/lib/stories";
import { timeAgo } from "@/lib/time";
import { ReportButton } from "./ReportButton";

export type StoryItem = { id: string; mediaId: string; caption: string | null; createdAt: string; audience: string; views: number; seen: boolean };
type Viewer = { nick: string; avatarId: string | null; viewedAt: string };

export function StoryViewer({ author, stories, owner }: { author: { nick: string; avatarId: string | null }; stories: StoryItem[]; owner: boolean }) {
  const router = useRouter();
  // começa no primeiro não visto
  const [idx, setIdx] = useState(() => Math.max(0, owner ? 0 : stories.findIndex((s) => !s.seen)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [pending, start] = useTransition();
  const marked = useRef(new Set<string>());
  const s = stories[idx];

  const close = useCallback(() => router.push("/feed"), [router]);
  const next = useCallback(() => {
    setProgress(0);
    if (idx < stories.length - 1) setIdx(idx + 1);
    else close();
  }, [idx, stories.length, close]);
  const prev = () => { setProgress(0); setIdx(Math.max(0, idx - 1)); };

  useEffect(() => {
    if (!s || owner || marked.current.has(s.id)) return;
    marked.current.add(s.id);
    void markStoryViewed(s.id);
  }, [s, owner]);

  useEffect(() => {
    if (paused || viewers) return;
    const step = 100 / (STORIES.seconds * 10);
    const t = setInterval(() => setProgress((p) => p + step), 100);
    return () => clearInterval(t);
  }, [paused, viewers, idx]);
  useEffect(() => { if (progress >= 100) next(); }, [progress, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!s && stories.length) setIdx(stories.length - 1);
    else if (!s) close();
  }, [s, stories.length, close]);

  if (!s) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white" onContextMenu={(e) => e.preventDefault()}>
      <div className="relative flex h-full w-full max-w-md flex-col">
        <div className="absolute inset-x-0 top-0 z-20 space-y-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <div className="flex gap-1">
            {stories.map((x, i) => (
              <div key={x.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
                <div className="h-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? Math.min(progress, 100) : 0}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/u/${author.nick}`} className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-wine">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {author.avatarId && <img src={`/api/media/${author.avatarId}?v=d`} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="truncate">{author.nick}</span>
            </Link>
            <span suppressHydrationWarning className="text-xs text-white/70">{timeAgo(s.createdAt)}{s.audience === "FRIENDS" && " · 🤝 amigos"}</span>
            <span className="flex-1" />
            <button onClick={() => setPaused(!paused)} className="px-2 text-lg" aria-label={paused ? "Continuar" : "Pausar"}>{paused ? "▶\uFE0E" : "❚❚"}</button>
            <button onClick={close} className="px-2 text-2xl leading-none" aria-label="Fechar">×</button>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={s.id} src={`/api/media/${s.mediaId}?v=d`} alt="" draggable={false} className="protected-img pointer-events-none h-full w-full select-none object-contain" />
        <button className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={prev} aria-label="Anterior" />
        <button className="absolute inset-y-0 right-0 z-10 w-2/3" onClick={next} aria-label="Próximo" />

        <div className="absolute inset-x-0 bottom-0 z-20 space-y-2 bg-gradient-to-t from-black/80 to-transparent p-4">
          {s.caption && <p className="text-center text-base">{s.caption}</p>}
          <div className="flex items-center justify-between text-sm">
            {owner ? (
              <>
                <button
                  onClick={async () => { setPaused(true); setViewers(await storyViewersAction(s.id)); }}
                  className="rounded-full bg-white/15 px-3 py-1.5"
                >👁 Visto por {s.views}</button>
                <button
                  disabled={pending}
                  onClick={() => start(async () => { if (confirm("Apagar este story?")) { await deleteStory(s.id); router.refresh(); } })}
                  className="rounded-full bg-white/15 px-3 py-1.5"
                >🗑 Apagar</button>
              </>
            ) : (
              <>
                <Link href={`/mensagens/${author.nick}`} className="rounded-full bg-white/15 px-3 py-1.5">✉️ Responder no PV</Link>
                <span onClick={() => setPaused(true)}><ReportButton targetType="MEDIA" targetId={s.mediaId} className="text-white/80" /></span>
              </>
            )}
          </div>
        </div>

        {viewers && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] overflow-y-auto rounded-t-2xl bg-panel p-4 text-fg">
            <div className="mb-2 flex items-center">
              <h2 className="flex-1 font-semibold">👁 Visto por {viewers.length}</h2>
              <button onClick={() => { setViewers(null); setPaused(false); }} className="text-2xl leading-none text-mute" aria-label="Fechar lista">×</button>
            </div>
            {viewers.length === 0 && <p className="text-sm text-mute">Ninguém viu ainda.</p>}
            <ul className="space-y-2">
              {viewers.map((v) => (
                <li key={v.nick}>
                  <Link href={`/u/${v.nick}`} className="flex items-center gap-2 text-sm">
                    <span className="h-8 w-8 overflow-hidden rounded-full bg-wine">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v.avatarId && <img src={`/api/media/${v.avatarId}?v=d`} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="flex-1 font-semibold">{v.nick}</span>
                    <span suppressHydrationWarning className="text-xs text-mute">{timeAgo(v.viewedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
