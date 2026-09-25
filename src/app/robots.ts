import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Buscadores: só as páginas públicas (entrada 18+, termos, privacidade). O resto exige login e fica fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/$", "/entrada", "/termos", "/privacidade", "/cadastro", "/opengraph-image"], disallow: ["/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
