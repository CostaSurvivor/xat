/**
 * Recursos prontos mas guardados para um lançamento futuro.
 * Liga no deploy com a variável de ambiente (NEXT_PUBLIC_* entra no build, vale no servidor e no navegador).
 */
export const FEATURES = {
  /** 📍 Lugares (guia de casas, bares, saunas…): NEXT_PUBLIC_FEATURE_LUGARES=1 */
  lugares: process.env.NEXT_PUBLIC_FEATURE_LUGARES === "1",
} as const;
