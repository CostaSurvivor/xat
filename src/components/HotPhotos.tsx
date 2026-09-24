import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { topPhotos } from "@/server/ranking";

/** Faixa "🔥 Em alta" (top fotos da semana) para a lateral do feed. */
export async function HotPhotos({ user }: { user: CurrentUser }) {
  const items = (await topPhotos(user, 7, undefined, 6)).slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-wine">🔥 Em alta na semana</h3>
        <Link href="/destaques" className="text-xs text-mute underline">ver tudo</Link>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(({ post }) => {
          const photo = post.media.find((m) => !m.video)!;
          return (
            <Link key={post.id} href={`/post/${post.id}`} className="block overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${photo.id}?v=d`} alt="" className="protected-img aspect-square w-full object-cover" draggable={false} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
