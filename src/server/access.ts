import "server-only";
import { db } from "@/lib/db";
import { isStaff, isSubscriber, isVerified, type CurrentUser } from "./auth";

export const MEDIA_REQUIRES_VERIFICATION = process.env.MEDIA_REQUIRES_VERIFICATION !== "false";

/** Algum dos dois bloqueou o outro? */
export async function isBlockedBetween(a: string, b: string) {
  if (a === b) return false;
  const n = await db.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
  return n > 0;
}

export async function blockedIds(userId: string) {
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
}

/** d = exibição (marca d'água), b = borrada, o = original (só dono/staff), v = vídeo (assinantes) */
export type MediaVariant = "d" | "b" | "o" | "v";

/**
 * Decide qual versão da mídia o usuário pode ver.
 * Retorna a variante efetiva (pode rebaixar "d" para "b") ou null (sem acesso).
 */
export async function resolveMediaAccess(viewer: CurrentUser, mediaId: string, want: MediaVariant) {
  const m = await db.media.findUnique({ where: { id: mediaId }, include: { owner: { select: { id: true, hideFromUnverified: true, status: true, albumVisibility: true } } } });
  if (!m) return null;
  const staff = isStaff(viewer);
  const own = m.ownerId === viewer.id;
  if (m.status !== "APPROVED" && !staff) return null;
  if (want === "o") return own || staff ? { media: m, variant: "o" as const } : null;
  if (want === "v" && m.kind !== "POST_VIDEO") return null;
  if (m.kind === "PM_AUDIO") {
    // áudio do PV: só quem está na conversa (dono e equipe já passaram acima); sem versão borrada
    if (own || staff) return { media: m, variant: "d" as const };
    if (m.owner.status !== "ACTIVE" || (await isBlockedBetween(viewer.id, m.ownerId))) return null;
    const pm = await db.privateMessage.findFirst({ where: { mediaId: m.id }, include: { conversation: true } });
    if (!pm || (pm.conversation.userAId !== viewer.id && pm.conversation.userBId !== viewer.id)) return null;
    return { media: m, variant: "d" as const };
  }
  if (own || staff) return { media: m, variant: want };
  if (m.owner.status !== "ACTIVE") return null;
  if (await isBlockedBetween(viewer.id, m.ownerId)) return null;

  const verified = isVerified(viewer);
  const blurOnly = (MEDIA_REQUIRES_VERIFICATION || m.owner.hideFromUnverified) && !verified;

  switch (m.kind) {
    case "VERIFICATION_SELFIE":
      return null;
    case "ROOM_COVER":
    case "EVENT_COVER":
      return { media: m, variant: want }; // fundo da sala / capa de evento: sem restrição
    case "POST_VIDEO":
      // pôster segue a regra das fotos; o vídeo em si é exclusivo de assinantes
      if (want === "v") return isSubscriber(viewer) && !blurOnly ? { media: m, variant: "v" as const } : null;
      break;
    case "STORY": {
      const st = await db.story.findFirst({ where: { mediaId: m.id } });
      if (!st) return null;
      const { canSeeStory } = await import("@/lib/stories");
      const friends = st.audience === "FRIENDS" ? await import("./friends").then((f) => f.areFriends(viewer.id, m.ownerId)) : false;
      if (!canSeeStory(st, viewer, { friends, blocked: false })) return null;
      break;
    }
    case "PRIVATE_ALBUM": {
      // álbum por tema: vale a visibilidade do álbum; sem álbum, a do álbum privado padrão
      const album = m.albumId ? await db.album.findUnique({ where: { id: m.albumId }, select: { visibility: true } }) : null;
      if (!(await canSeeAlbum(viewer.id, m.ownerId, album?.visibility ?? m.owner.albumVisibility, { viewerVerified: verified, albumId: album ? m.albumId : null }))) return { media: m, variant: "b" as const };
      break;
    }
    case "PM_PHOTO": {
      const pm = await db.privateMessage.findFirst({ where: { mediaId: m.id }, include: { conversation: true } });
      if (!pm) return null;
      const c = pm.conversation;
      if (c.userAId !== viewer.id && c.userBId !== viewer.id) return null;
      if (!pm.revealedAt) return { media: m, variant: "b" as const };
      break;
    }
  }
  return { media: m, variant: blurOnly ? ("b" as const) : want };
}

/**
 * Álbum privado: o dono escolhe quem vê (PRIVATE = só liberados um a um,
 * FRIENDS = amigos, FOLLOWERS = seguidores). Liberação individual vale sempre.
 */
export async function canSeeAlbum(viewerId: string, ownerId: string, visibility: string, opts: { viewerVerified?: boolean; albumId?: string | null } = {}) {
  if (viewerId === ownerId) return true;
  // "só verificados" vale por si (não depende da configuração global de borrar para não verificados)
  if (visibility === "VERIFIED") return opts.viewerVerified === true;
  // liberação individual: no álbum por tema vale só para AQUELE álbum; no álbum privado padrão, a do dono
  const granted = opts.albumId
    ? (await db.themedAlbumAccess.findUnique({ where: { albumId_viewerId: { albumId: opts.albumId, viewerId } } }))?.granted
    : (await db.albumAccess.findUnique({ where: { ownerId_viewerId: { ownerId, viewerId } } }))?.granted;
  if (granted) return true;
  if (visibility === "FRIENDS") {
    const { areFriends } = await import("./friends");
    return areFriends(viewerId, ownerId);
  }
  if (visibility === "FOLLOWERS") {
    return !!(await db.follow.findUnique({ where: { followerId_followeeId: { followerId: viewerId, followeeId: ownerId } } }));
  }
  return false;
}
