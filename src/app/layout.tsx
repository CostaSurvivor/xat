import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · chat liberal 18+`, template: `%s · ${SITE_NAME}` },
  description: "Comunidade liberal 18+: salas de chat, fotos e casais.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0708", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
