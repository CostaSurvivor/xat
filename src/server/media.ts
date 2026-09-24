import "server-only";
import sharp from "sharp";
import { createHash, randomBytes } from "node:crypto";
import type { MediaKind } from "@prisma/client";
import { db } from "@/lib/db";
import { SITE_NAME } from "@/lib/config";
import { storage } from "./storage";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const OK_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

export class MediaError extends Error {}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** SVG de marca d'água: texto diagonal repetido + faixa no rodapé. */
function watermarkSvg(w: number, h: number, text: string) {
  const t = esc(text);
  const size = Math.max(14, Math.round(Math.min(w, h) / 22));
  const rows: string[] = [];
  const stepY = size * 6;
  const stepX = size * 14;
  for (let y = -h; y < h * 2; y += stepY) {
    for (let x = -w; x < w * 2; x += stepX) {
      rows.push(`<text x="${x}" y="${y}">${t}</text>`);
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <g transform="rotate(-30 ${w / 2} ${h / 2})" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}"
     fill="#ffffff" fill-opacity="0.16" stroke="#000000" stroke-opacity="0.12" stroke-width="1">${rows.join("")}</g>
  <rect x="0" y="${h - size * 2}" width="${w}" height="${size * 2}" fill="#000" fill-opacity="0.35"/>
  <text x="${w - 12}" y="${h - size * 0.6}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif"
     font-size="${size}" fill="#d4af37" fill-opacity="0.9">${t}</text>
</svg>`);
}

export async function renderWatermarked(input: Buffer, text: string, maxSide = 1280) {
  const base = sharp(input).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await base.toBuffer({ resolveWithObject: true });
  return sharp(data)
    .composite([{ input: watermarkSvg(info.width, info.height, text), top: 0, left: 0 }])
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * Processa upload: valida imagem, remove EXIF/GPS (sharp descarta metadados
 * por padrão), gera original privado, versão com marca d'água e prévia borrada.
 * Hash conferido contra a blocklist antes de qualquer gravação.
 */
export async function processUpload(opts: { file: File; ownerId: string; ownerNick: string; kind: MediaKind; watermark?: boolean; watermarkText?: string }) {
  const { file } = opts;
  if (!file || file.size === 0) throw new MediaError("Arquivo vazio");
  if (file.size > MAX_UPLOAD_BYTES) throw new MediaError("Foto muito grande (máx. 10 MB)");
  const input = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(input).digest("hex");
  if (await db.mediaHashBlock.findUnique({ where: { sha256: sha } })) throw new MediaError("Esta imagem não é permitida.");

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new MediaError("Arquivo não é uma imagem válida");
  }
  if (!meta.format || !OK_FORMATS.has(meta.format)) throw new MediaError("Formato não suportado (use JPG, PNG ou WEBP)");

  const original = await sharp(input).rotate().resize(2560, 2560, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const wmText = opts.watermarkText ?? `@${opts.ownerNick} · ${SITE_NAME}`;
  const display = opts.watermark === false
    ? await sharp(original.data).resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    : await renderWatermarked(original.data, wmText);
  const blur = await sharp(original.data).resize(48, 48, { fit: "inside" }).blur(4).resize(480, 480, { fit: "inside" }).webp({ quality: 50 }).toBuffer();

  const d = new Date();
  const dir = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(12).toString("hex")}`;
  await storage.put(`${dir}/o.webp`, original.data);
  await storage.put(`${dir}/d.webp`, display);
  await storage.put(`${dir}/b.webp`, blur);

  return db.media.create({
    data: {
      ownerId: opts.ownerId,
      kind: opts.kind,
      originalKey: `${dir}/o.webp`,
      displayKey: `${dir}/d.webp`,
      blurKey: `${dir}/b.webp`,
      width: original.info.width,
      height: original.info.height,
      sha256: sha,
    },
  });
}
