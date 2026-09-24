import "server-only";

/**
 * Ponto de integração com serviço de detecção de abuso sexual infantil (CSAM),
 * como Microsoft PhotoDNA, Thorn Safer ou similar (exigem cadastro/aprovação).
 *
 * Sem configuração: só a blocklist local de hashes (MediaHashBlock) é usada.
 * Com CSAM_SCAN_URL/CSAM_SCAN_KEY: cada imagem é enviada para análise antes de
 * ser publicada. Contrato esperado da API: POST (imagem no corpo) -> { match: boolean }.
 * Adapte `scanExternal` ao formato do serviço contratado.
 */
export type ScanResult = { match: boolean; provider: string; detail?: string };

export async function scanImage(image: Buffer): Promise<ScanResult | null> {
  const url = process.env.CSAM_SCAN_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Authorization: `Bearer ${process.env.CSAM_SCAN_KEY ?? ""}` },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { match: false, provider: "external", detail: `http ${res.status}` };
    const j = (await res.json()) as { match?: boolean };
    return { match: !!j.match, provider: "external" };
  } catch (e) {
    // falha do serviço não bloqueia o upload, mas fica registrada
    return { match: false, provider: "external", detail: String(e).slice(0, 200) };
  }
}
