import Link from "next/link";
import { isVerified } from "@/server/auth";
import { storyTray } from "@/server/stories";
import { Avatar } from "./Avatar";

type Viewer = { id: string; nick: string; avatarId: string | null; role: string; state: string | null; ageVerification: string };

/** Bandeja de stories no topo do feed. Anel colorido = tem story que você ainda não viu. */
export async function StoryTray({ viewer }: { viewer: Viewer }) {
  const items = await storyTray(viewer);
  const mine = items.find((i) => i.authorId === viewer.id);
  const others = items.filter((i) => i.authorId !== viewer.id);
  if (!others.length && !mine && !isVerified(viewer)) return null;
  return (
    <div className="card flex gap-3 overflow-x-auto p-3" aria-label="Stories">
      {isVerified(viewer) && (
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <Link href={mine ? `/stories/${viewer.nick}` : "/stories/novo"} className={`relative rounded-full p-[3px] ${mine ? "bg-line" : ""}`} aria-label={mine ? "Ver meus stories" : "Postar story"}>
            <span className="block rounded-full bg-panel p-[2px]"><Avatar mediaId={viewer.avatarId} nick={viewer.nick} size={54} /></span>
          </Link>
          <Link href="/stories/novo" className="-mt-5 ml-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-panel bg-wine2 text-xs font-bold leading-none text-white" aria-label="Novo story">+</Link>
          <span className="w-full truncate text-center text-[11px] text-mute">Seu story</span>
        </div>
      )}
      {others.map((i) => (
        <Link key={i.authorId} href={`/stories/${i.author.nick}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className={`rounded-full p-[3px] ${i.unseen ? "bg-gradient-to-tr from-amber-400 via-wine2 to-fuchsia-600" : "bg-line"}`}>
            <span className="block rounded-full bg-panel p-[2px]"><Avatar mediaId={i.author.avatarId} nick={i.author.nick} size={54} style={i.style} /></span>
          </span>
          <span className={`w-full truncate text-center text-[11px] ${i.unseen ? "font-semibold text-fg" : "text-mute"}`}>{i.author.nick}</span>
        </Link>
      ))}
      {!others.length && <p className="self-center text-xs text-mute">Nenhum story de quem você segue agora. Poste o seu: some em 24 h. ⏳</p>}
    </div>
  );
}
