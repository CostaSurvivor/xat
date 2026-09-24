import "server-only";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

/**
 * Armazenamento de mídia. Dois drivers:
 * - "local" (padrão): disco. Na Hostinger, aponte UPLOAD_DIR para uma pasta FORA
 *   da pasta do app (senão um redeploy pode apagar as fotos).
 * - "s3": qualquer S3 compatível (Cloudflare R2, AWS S3, Backblaze B2, Wasabi…).
 *   O bucket fica PRIVADO: as mídias continuam saindo só por /api/media/[id],
 *   que aplica as regras de acesso (assinante, álbum, PV, marca d'água).
 */
export interface Storage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  size(key: string): Promise<number>;
  /** Intervalo de bytes (vídeo com Range). */
  stream(key: string, start: number, end: number): Promise<ReadableStream>;
  remove(key: string): Promise<void>;
}

function localStorage(): Storage {
  const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage");
  const safe = (key: string) => {
    const p = path.resolve(ROOT, key);
    if (!p.startsWith(ROOT + path.sep)) throw new Error("storage: chave inválida");
    return p;
  };
  return {
    async put(key, data) {
      const p = safe(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    get: (key) => readFile(safe(key)),
    size: async (key) => (await stat(safe(key))).size,
    stream: async (key, start, end) => Readable.toWeb(createReadStream(safe(key), { start, end })) as ReadableStream,
    remove: async (key) => { await unlink(safe(key)).catch(() => {}); },
  };
}

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("storage: defina S3_BUCKET");
  const prefix = (process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
  const k = (key: string) => {
    if (key.includes("..") || key.startsWith("/")) throw new Error("storage: chave inválida");
    return prefix ? `${prefix}/${key}` : key;
  };
  // import tardio: só carrega o SDK quando o driver s3 está ligado
  const load = (async () => {
    const S3 = await import("@aws-sdk/client-s3");
    const client = new S3.S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined, // R2: https://<conta>.r2.cloudflarestorage.com
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
    });
    return { S3, client };
  })();
  return {
    async put(key, data, contentType) {
      const { S3, client } = await load;
      await client.send(new S3.PutObjectCommand({ Bucket: bucket, Key: k(key), Body: data, ContentType: contentType }));
    },
    async get(key) {
      const { S3, client } = await load;
      const r = await client.send(new S3.GetObjectCommand({ Bucket: bucket, Key: k(key) }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async size(key) {
      const { S3, client } = await load;
      return (await client.send(new S3.HeadObjectCommand({ Bucket: bucket, Key: k(key) }))).ContentLength ?? 0;
    },
    async stream(key, start, end) {
      const { S3, client } = await load;
      const r = await client.send(new S3.GetObjectCommand({ Bucket: bucket, Key: k(key), Range: `bytes=${start}-${end}` }));
      return r.Body!.transformToWebStream();
    },
    async remove(key) {
      const { S3, client } = await load;
      await client.send(new S3.DeleteObjectCommand({ Bucket: bucket, Key: k(key) })).catch(() => {});
    },
  };
}

export const storage: Storage = process.env.STORAGE_DRIVER === "s3" ? s3Storage() : localStorage();
