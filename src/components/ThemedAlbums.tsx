import { db } from "@/lib/db";
import { ALBUMS, ALBUM_VISIBILITY, type AlbumVisibility } from "@/lib/albums";
import { canSeeAlbum } from "@/server/access";
import { createAlbum, deleteAlbum, requestThemedAlbum, setThemedAlbumAccess, updateAlbum } from "@/app/actions/albums";
import { deleteMedia, uploadPhoto } from "@/app/actions/profile";
import { ActionForm, AutoSubmitFile } from "./Forms";
import { ProtectedImage } from "./ProtectedImage";
import { ConfirmButton } from "./ConfirmButton";

const visLabel = (v: string) => ALBUM_VISIBILITY[v as AlbumVisibility] ?? v;

function VisibilitySelect({ value }: { value?: string }) {
  return (
    <select name="visibility" defaultValue={value ?? "FRIENDS"} className="input w-auto py-1.5 text-sm" aria-label="Quem pode ver">
      {Object.entries(ALBUM_VISIBILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

/** Dono: cria, edita, envia fotos e apaga álbuns por tema. */
export async function ThemedAlbumsOwner({ ownerId, verified }: { ownerId: string; verified: boolean }) {
  const albums = await db.album.findMany({ where: { ownerId }, orderBy: { position: "asc" } });
  const photos = await db.media.findMany({ where: { albumId: { in: albums.map((a) => a.id) }, status: "APPROVED" }, orderBy: { createdAt: "desc" }, select: { id: true, albumId: true } });
  const requests = await db.themedAlbumAccess.findMany({ where: { albumId: { in: albums.map((a) => a.id) } }, orderBy: { createdAt: "desc" } });
  const reqUsers = await db.user.findMany({ where: { id: { in: requests.map((r) => r.viewerId) }, status: "ACTIVE" }, select: { id: true, nick: true } });
  const nickOf = new Map(reqUsers.map((u) => [u.id, u.nick]));
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-gold">📚 Álbuns por tema</h2>
        <p className="text-xs text-mute">Separe suas fotos por tema (viagens, lingerie, festas…) e escolha quem vê cada álbum. Até {ALBUMS.max} álbuns com {ALBUMS.photosPerAlbum} fotos cada.</p>
      </div>
      {albums.map((a) => {
        const list = photos.filter((p) => p.albumId === a.id);
        return (
          <div key={a.id} className="space-y-2 rounded-xl border border-line p-3" data-album={a.name}>
            <ActionForm action={updateAlbum.bind(null, a.id)} okText="Álbum salvo!" className="flex flex-wrap items-center gap-2">
              <input name="emoji" defaultValue={a.emoji} maxLength={8} className="input w-14 py-1.5 text-center" aria-label="Emoji" />
              <input name="name" defaultValue={a.name} maxLength={40} className="input min-w-32 flex-1 py-1.5" aria-label="Nome do álbum" />
              <VisibilitySelect value={a.visibility} />
              <button className="btn-ghost py-1 text-xs">Salvar</button>
            </ActionForm>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-mute">{list.length}/{ALBUMS.photosPerAlbum} fotos</span>
              <span className="flex-1" />
              {verified && list.length < ALBUMS.photosPerAlbum && (
                <ActionForm action={uploadPhoto} okText="Foto adicionada!">
                  <input type="hidden" name="kind" value="PRIVATE_ALBUM" />
                  <input type="hidden" name="albumId" value={a.id} />
                  <AutoSubmitFile name="photo" label="+ Foto" />
                </ActionForm>
              )}
              <form action={deleteAlbum.bind(null, a.id)}><ConfirmButton message={`Apagar o álbum "${a.name}" e todas as fotos dele?`} className="text-xs text-red-700 hover:underline">Apagar álbum e fotos</ConfirmButton></form>
            </div>
            {requests.filter((r) => r.albumId === a.id && nickOf.has(r.viewerId)).length > 0 && (
              <ul className="space-y-1 rounded-lg bg-panel2/60 p-2 text-sm" aria-label="Pedidos de acesso">
                {requests.filter((r) => r.albumId === a.id && nickOf.has(r.viewerId)).map((r) => (
                  <li key={r.viewerId} className="flex items-center gap-2">
                    <span className="mr-auto">@{nickOf.get(r.viewerId)} {r.granted ? <span className="text-xs text-green-700">· liberado</span> : <span className="text-xs text-mute">· pediu acesso</span>}</span>
                    <form action={setThemedAlbumAccess.bind(null, a.id, r.viewerId, !r.granted)}><button className={r.granted ? "btn-ghost py-0.5 text-xs" : "btn-gold py-0.5 text-xs"}>{r.granted ? "Revogar" : "Liberar"}</button></form>
                  </li>
                ))}
              </ul>
            )}
            {list.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {list.map((m) => (
                  <div key={m.id} className="relative">
                    <ProtectedImage id={m.id} className="aspect-square rounded-lg" />
                    <form action={deleteMedia.bind(null, m.id)} className="absolute right-1 top-1"><button className="rounded-full bg-black/70 px-2 text-xs text-white">✕</button></form>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {verified ? (
        albums.length < ALBUMS.max && (
          <ActionForm action={createAlbum} okText="Álbum criado!" resetOnOk className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <input name="emoji" defaultValue="📁" maxLength={8} className="input w-14 py-1.5 text-center" aria-label="Emoji" />
            <input name="name" required minLength={2} maxLength={40} placeholder="Nome do novo álbum (ex.: Viagens)" className="input min-w-40 flex-1 py-1.5" />
            <VisibilitySelect />
            <button className="btn-gold py-1.5">Criar álbum</button>
          </ActionForm>
        )
      ) : (
        <p className="text-xs text-mute">Verifique seu perfil para criar álbuns.</p>
      )}
    </section>
  );
}

/** Visitante: cada álbum com o próprio cadeado. */
export async function ThemedAlbumsViewer({ owner, viewerId, viewerVerified }: { owner: { id: string; nick: string }; viewerId: string; viewerVerified: boolean }) {
  const albums = await db.album.findMany({ where: { ownerId: owner.id }, orderBy: { position: "asc" } });
  if (!albums.length) return null;
  const photos = await db.media.findMany({ where: { albumId: { in: albums.map((a) => a.id) }, status: "APPROVED" }, orderBy: { createdAt: "desc" }, select: { id: true, albumId: true } });
  const withPhotos = albums.filter((a) => photos.some((p) => p.albumId === a.id));
  if (!withPhotos.length) return null;
  const access = await Promise.all(withPhotos.map((a) => canSeeAlbum(viewerId, owner.id, a.visibility, { viewerVerified, albumId: a.id })));
  const asked = new Set((await db.themedAlbumAccess.findMany({ where: { viewerId, albumId: { in: withPhotos.map((a) => a.id) } }, select: { albumId: true } })).map((r) => r.albumId));
  return (
    <>
      {withPhotos.map((a, i) => {
        const list = photos.filter((p) => p.albumId === a.id);
        const open = access[i];
        return (
          <section key={a.id} className="card p-4" data-album={a.name}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold text-gold">{a.emoji} {a.name} ({list.length})</h2>
              <span className="text-[11px] text-mute">{visLabel(a.visibility)}</span>
              {!open && a.visibility === "PRIVATE" && (asked.has(a.id) ? <span className="text-xs text-mute">Pedido enviado</span> : <form action={requestThemedAlbum.bind(null, a.id)}><button className="btn-wine py-1 text-xs">Pedir acesso</button></form>)}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {list.slice(0, open ? 30 : 6).map((m) => <ProtectedImage key={m.id} id={m.id} className="aspect-square rounded-lg" />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
