/** Endereço público do site (PUBLIC_URL no ambiente; troca quando o domínio próprio entrar no ar). */
export function siteUrl() {
  return (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}
