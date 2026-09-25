/**
 * IP do visitante atrás de proxy (testado em tests/ip.test.ts).
 *
 * O começo do X-Forwarded-For é escrito por quem faz a requisição (dá para inventar);
 * só as últimas entradas foram acrescentadas pelos nossos proxies. Com N proxies de
 * confiança na frente do app (TRUSTED_PROXY_HOPS, padrão 1), o IP real é a N-ésima
 * entrada de trás para frente.
 */
export function clientIpFrom(get: (name: string) => string | null | undefined, hops = 1) {
  const list = (get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const n = Number.isInteger(hops) && hops > 0 ? hops : 1;
  if (list.length) return clean(list[Math.max(0, list.length - n)]);
  return clean(get("x-real-ip") ?? "") ?? "0.0.0.0";
}

function clean(ip: string | undefined) {
  const s = (ip ?? "").trim().slice(0, 64);
  return /^[0-9a-fA-F:.]+$/.test(s) ? s : "0.0.0.0";
}
