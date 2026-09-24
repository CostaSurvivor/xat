"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commentOnPost, deleteComment, deletePost, loadComments, reactToPost } from "@/app/actions/posts";
import { PROFILE_TYPES, REACTIONS } from "@/lib/config";
import { timeAgo } from "@/lib/time";
import type { FeedPost } from "@/server/feed";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ProtectedImage } from "./ProtectedImage";
import { ReportButton } from "./ReportButton";

type Comment = Awaited<ReturnType<typeof loadComments>>[number];

export function PostCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  const [reactions, setReactions] = useState(post.reactions);
  const [mine, setMine] = useState(post.myReaction);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [pending, start] = useTransition();
  const a = post.author;

  function react(e: string) {
    const next = { ...reactions };
    if (mine) next[mine] = Math.max(0, (next[mine] ?? 1) - 1);
    if (mine !== e) next[e] = (next[e] ?? 0) + 1;
    setReactions(next);
    setMine(mine === e ? null : e);
    start(() => reactToPost(post.id, e));
  }
  async function openComments() {
    setComments(await loadComments(post.id));
  }

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 p-3">
        <Avatar mediaId={a.avatarId} nick={a.nick} style={a.style} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate">
            <Nick nick={a.nick} style={a.style} />
            {a.ageVerification === "APPROVED" && <span title="Verificado" className="ml-1 text-xs text-gold">✔</span>}
          </div>
          <div className="text-xs text-mute">
            {PROFILE_TYPES[a.profileType as keyof typeof PROFILE_TYPES]?.label}
            {a.city ? ` · ${a.city}/${a.state}` : ""} · {timeAgo(post.createdAt)}
            {post.visibility === "FOLLOWERS" && " · 🔒 seguidores"}
          </div>
        </div>
        {post.canDelete ? (
          <button onClick={() => start(async () => { if (confirm("Apagar post?")) { await deletePost(post.id); router.refresh(); } })} className="text-xs text-mute hover:text-red-300">Apagar</button>
        ) : (
          <ReportButton targetType="POST" targetId={post.id} label="" />
        )}
      </header>
      {post.body && <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px]">{post.body}</p>}
      {post.media.length > 0 && (
        <div className="relative">
          <ProtectedImage id={post.media[idx].id} className="aspect-[4/5] max-h-[75vh] w-full" />
          {post.media.length > 1 && (
            <>
              <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 text-xs">{idx + 1}/{post.media.length}</div>
              {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1">‹</button>}
              {idx < post.media.length - 1 && <button onClick={() => setIdx(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1">›</button>}
            </>
          )}
        </div>
      )}
      <footer className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => react(e)} className={`rounded-full border px-2.5 py-1 text-sm transition ${mine === e ? "border-gold bg-gold/15" : "border-line hover:border-gold/50"}`}>
              {e} {reactions[e] ? <span className="text-xs text-mute">{reactions[e]}</span> : null}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={openComments} className="text-sm text-mute hover:text-white">💬 {count}</button>
        </div>
        {comments && (
          <div className="space-y-2 border-t border-line pt-2">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-sm">
                <Avatar mediaId={c.author.avatarId} nick={c.author.nick} size={26} style={c.author.style} />
                <div className="min-w-0 flex-1">
                  <Nick nick={c.author.nick} style={c.author.style} /> <span className="break-words">{c.body}</span>
                  <div className="text-[11px] text-mute">
                    {timeAgo(c.createdAt)}
                    {c.canDelete ? (
                      <button className="ml-2 hover:text-red-300" onClick={async () => { await deleteComment(c.id); setComments(comments.filter((x) => x.id !== c.id)); setCount((n) => n - 1); }}>apagar</button>
                    ) : (
                      <ReportButton targetType="COMMENT" targetId={c.id} label="" className="ml-2" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await commentOnPost(post.id, text);
                  if (!r.ok) return setErr(r.error ?? "Erro");
                  setErr(null);
                  setText("");
                  setCount((n) => n + 1);
                  await openComments();
                });
              }}
              className="flex gap-2"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Comentar…" className="input py-1.5" />
              <button disabled={pending || !text.trim()} className="btn-wine py-1.5">Enviar</button>
            </form>
            {err && <p className="text-xs text-red-300">{err}</p>}
          </div>
        )}
      </footer>
    </article>
  );
}
