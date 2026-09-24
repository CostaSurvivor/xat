import { describe, expect, it } from "vitest";
import { ALBUMS, ALBUM_VISIBILITY, albumSchema, createAlbumError } from "@/lib/albums";

describe("álbuns por tema", () => {
  it("valida nome, emoji e visibilidade", () => {
    expect(albumSchema.safeParse({ name: "Viagens", emoji: "✈️", visibility: "FRIENDS" }).success).toBe(true);
    expect(albumSchema.safeParse({ name: "x", emoji: "✈️", visibility: "FRIENDS" }).success).toBe(false);
    expect(albumSchema.safeParse({ name: "Viagens", emoji: "✈️", visibility: "PUBLIC" }).success).toBe(false);
    expect(albumSchema.safeParse({ name: "veja www.x.com", emoji: "✈️", visibility: "PRIVATE" }).success).toBe(false);
  });
  it("limite de álbuns e rótulos para todas as opções", () => {
    expect(createAlbumError(ALBUMS.max - 1)).toBeNull();
    expect(createAlbumError(ALBUMS.max)).toMatch(/Máximo/);
    expect(Object.keys(ALBUM_VISIBILITY).sort()).toEqual(["FOLLOWERS", "FRIENDS", "PRIVATE", "VERIFIED"]);
  });
});
