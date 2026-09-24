import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Comunidade liberal 18+: salas de chat, feed, ao vivo e PV.",
    id: "/",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0708",
    theme_color: "#0b0708",
    lang: "pt-BR",
    categories: ["social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Salas", url: "/salas" },
      { name: "Ao vivo", url: "/ao-vivo" },
      { name: "PV", url: "/mensagens" },
    ],
  };
}
