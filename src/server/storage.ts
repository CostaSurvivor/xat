import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento local em disco. Na Hostinger, aponte UPLOAD_DIR para uma pasta
 * FORA da pasta do app (senão um redeploy pode apagar as fotos).
 * Interface pronta para trocar por R2/S3 depois.
 */
const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage");

function safe(key: string) {
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("storage: chave inválida");
  return p;
}

export const storage = {
  async put(key: string, data: Buffer) {
    const p = safe(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  },
  async get(key: string) {
    return readFile(safe(key));
  },
  async remove(key: string) {
    await unlink(safe(key)).catch(() => {});
  },
};
