/** Favoritos privados: regras puras (testadas em tests/favorites.test.ts). */

export const FAVORITES = { max: 500, noteMax: 300 };

/** Anotação privada: até 300 caracteres, espaços normalizados; vazia vira null. */
export function cleanNote(raw: unknown): { note: string | null } | { error: string } {
  const note = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (note.length > FAVORITES.noteMax) return { error: `A anotação pode ter até ${FAVORITES.noteMax} caracteres` };
  return { note: note || null };
}

export function favoriteError(ownerId: string, targetId: string, count: number, blocked: boolean) {
  if (ownerId === targetId) return "Você não pode favoritar o próprio perfil";
  if (blocked) return "Indisponível";
  if (count >= FAVORITES.max) return `Limite de ${FAVORITES.max} favoritos. Remova alguns para adicionar outros.`;
  return null;
}
