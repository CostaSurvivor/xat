import "server-only";
import { db } from "@/lib/db";
import { PIX } from "@/lib/config";

export type PixConfig = { key: string; merchantName: string; merchantCity: string };

/** Pix configurado no painel (Admin → Configurações); variáveis de ambiente são o padrão. */
export async function getPixConfig(): Promise<PixConfig> {
  const row = await db.platformSetting.findUnique({ where: { key: "pix" } });
  const v = (row?.value ?? {}) as Partial<PixConfig>;
  return {
    key: v.key || PIX.key,
    merchantName: v.merchantName || PIX.merchantName,
    merchantCity: v.merchantCity || PIX.merchantCity,
  };
}

/** Imagem de fundo da tela inicial (enviada em Admin → Configurações). */
export async function getHeroImage(): Promise<{ key: string; v: string } | null> {
  const row = await db.platformSetting.findUnique({ where: { key: "hero" } });
  const v = row?.value as { key?: string; v?: string } | undefined;
  return v?.key ? { key: v.key, v: v.v ?? "1" } : null;
}
