/**
 * Copia todas as mídias do disco (UPLOAD_DIR) para o bucket S3/R2.
 * Uso: defina as variáveis S3_* e rode `npm run storage:to-s3`.
 * Depois troque STORAGE_DRIVER para "s3" e faça o redeploy.
 * Pode rodar mais de uma vez: só reenvia o que ainda não existe no bucket.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage");
const bucket = process.env.S3_BUCKET;
if (!bucket) throw new Error("Defina S3_BUCKET");
const prefix = (process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
const client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
});

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function main() {
  let sent = 0, skipped = 0;
  for await (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const Key = prefix ? `${prefix}/${rel}` : rel;
    const exists = await client.send(new HeadObjectCommand({ Bucket: bucket, Key })).then(() => true, () => false);
    if (exists) { skipped++; continue; }
    await client.send(new PutObjectCommand({ Bucket: bucket, Key, Body: await readFile(file) }));
    sent++;
    if (sent % 50 === 0) console.log(`${sent} enviados…`);
  }
  console.log(`Pronto: ${sent} enviados, ${skipped} já existiam.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
