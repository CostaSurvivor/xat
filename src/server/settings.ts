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
