"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commentOnPost, deleteComment, deletePost, loadComments, reactToComment, reactToPost } from "@/app/actions/posts";
import { PROFILE_TYPES, REACTIONS } from "@/lib/config";
import { timeAgo } from "@/lib/time";
import type { FeedPost } from "@/server/feed";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ProtectedImage } from "./ProtectedImage";
import { ReportButton } from "./ReportButton";
import { VideoPlayer } from "./VideoPlayer";

type Comment = Awaited<ReturnType<typeof loadComments>>[number];
type CommentView = Omit<Comment, "replies">;

function CommentItem({ c, onReply, onDelete, small = false }: { c: CommentView; onReply: () => void; onDelete: () => void; small?: boolean }) {
  const [reactions, setReactions] = useState(c.reactions);
  const [mine, setMine] = useState(c.myReaction);
  const [picker, setPicker] = useState(false);
  const react = (e: string) => {
    const next = { ...reactions };
    if (mine) next[mine] = Math.max(0, (next[mine] ?? 1) - 1);
    if (mine !== e) next[e] = (next[e] ?? 0) + 1;
    setReactions(next);
    setMine(mine === e ? null : e);
    setPicker(false);
    reactToComment(c.id, e);
  };
  const total = Object.entries(reactions).filter(([, n]) => n > 0);
  return (
    <div className="flex gap-2 text-sm">
      <Avatar mediaId={c.author.avatarId} nick={c.author.nick} size={small ? 22 : 26} style={c.author.style} />
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl bg-panel2 px-3 py-1.5">
          <Nick nick={c.author.nick} style={c.author.style} /> <span className="break-words">{c.body}</span>
        </div>
        <div className="relative mt-0.5 flex flex-wrap items-center gap-3 pl-2 text-[11px] text-mute">
          <span>{timeAgo(c.createdAt)}</span>
          <button onClick={() => setPicker((v) => !v)} className={mine ? "font-semibold text-gold" : "hover:text-white"}>{mine ? `${mine} Reagiu` : "Reagir"}</button>
          <button onClick={onReply} className="hover:text-white">Responder</button>
          {c.canDelete ? <button className="hover:text-red-300" onClick={onDelete}>apagar</button> : <ReportButton targetType="COMMENT" targetId={c.id} label="" />}
          {total.length > 0 && <span className="rounded-full bg-panel2 px-1.5">{total.map(([e]) => e).join("")} {total.reduce((s, [, n]) => s + n, 0)}</span>}
          {picker && (
            <div className="absolute -top-9 left-8 z-10 flex gap-1 rounded-full border border-line bg-panel px-2 py-1 shadow-xl">
              {REACTIONS.map((e) => <button key={e} onClick={() => react(e)} className="text-lg transition hover:scale-125">{e}</button>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PostCard({ post, viewer }: { post: FeedPost; viewer: { nick: string; subscriber: boolean } }) {
  const router = useRouter();
  const [reactions, setReactions] = useState(post.reactions);
  const [mine, setMine] = useState(post.myReaction);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; nick: string } | null>(null);
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
            {a.vip && <span title="Assinante" className="ml-1 rounded bg-gold px-1 text-[10px] font-bold text-ink">VIP</span>}
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
          {post.media[idx].video ? (
            <VideoPlayer id={post.media[idx].id} canWatch={viewer.subscriber || post.canDelete} viewerNick={viewer.nick} className="aspect-[4/5] max-h-[75vh] w-full" />
          ) : (
            <ProtectedImage id={post.media[idx].id} className="aspect-[4/5] max-h-[75vh] w-full" />
          )}
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
          <div className="space-y-3 border-t border-line pt-3">
            {comments.map((c) => (
              <div key={c.id} className="space-y-2">
                <CommentItem
                  c={c}
                  onReply={() => { setReplyTo({ id: c.id, nick: c.author.nick }); setText(`@${c.author.nick} `); }}
                  onDelete={async () => { await deleteComment(c.id); await openComments(); setCount((n) => n - 1); }}
                />
                {c.replies.length > 0 && (
                  <div className="ml-8 space-y-2 border-l border-line pl-3">
                    {c.replies.map((r) => (
                      <CommentItem
                        key={r.id}
                        c={r}
                        small
                        onReply={() => { setReplyTo({ id: c.id, nick: r.author.nick }); setText(`@${r.author.nick} `); }}
                        onDelete={async () => { await deleteComment(r.id); await openComments(); setCount((n) => n - 1); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {replyTo && (
              <p className="text-xs text-mute">Respondendo @{replyTo.nick} · <button onClick={() => { setReplyTo(null); setText(""); }} className="underline">cancelar</button></p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await commentOnPost(post.id, text, replyTo?.id);
                  if (!r.ok) return setErr(r.error ?? "Erro");
                  setErr(null);
                  setText("");
                  setReplyTo(null);
                  setCount((n) => n + 1);
                  await openComments();
                });
              }}
              className="flex gap-2"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={replyTo ? "Sua resposta…" : "Comentar…"} className="input py-1.5" />
              <button disabled={pending || !text.trim()} className="btn-wine py-1.5">Enviar</button>
            </form>
            {err && <p className="text-xs text-red-300">{err}</p>}
          </div>
        )}
      </footer>
    </article>
  );
}
