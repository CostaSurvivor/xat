import { z } from "zod";

/** Álbuns por tema: regras puras (testadas em tests/albums.test.ts). */

export const ALBUMS = { max: 10, photosPerAlbum: 30 };

export const ALBUM_VISIBILITY = {
  VERIFIED: "✔ Perfis verificados",
  FOLLOWERS: "👀 Seguidores",
  FRIENDS: "🤝 Amigos",
  PRIVATE: "🔒 Só quem eu liberar",
} as const;
export type AlbumVisibility = keyof typeof ALBUM_VISIBILITY;

export const albumSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(40, "Nome muito longo").refine((s) => !/https?:\/\/|www\./i.test(s), "Links não são permitidos"),
  emoji: z.string().trim().min(1).max(8).default("📁"),
  visibility: z.enum(["VERIFIED", "FOLLOWERS", "FRIENDS", "PRIVATE"]),
});

export function createAlbumError(count: number) {
  return count >= ALBUMS.max ? `Máximo de ${ALBUMS.max} álbuns.` : null;
}
