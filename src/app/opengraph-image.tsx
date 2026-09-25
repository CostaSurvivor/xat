import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/config";

/** Prévia do link (WhatsApp, Telegram, X…): discreta, sem nada explícito. */
export const alt = `${SITE_NAME} · comunidade liberal 18+`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "linear-gradient(135deg, #7a0f3a 0%, #b3124e 55%, #e0527e 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: "white", color: "#b3124e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60, fontWeight: 800 }}>S</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>{SITE_NAME}</div>
        </div>
        <div style={{ marginTop: 36, fontSize: 44, fontWeight: 600, lineHeight: 1.2, maxWidth: 950 }}>Comunidade liberal para casais e solteiros</div>
        <div style={{ marginTop: 18, fontSize: 32, opacity: 0.9 }}>Chat por estado · perfis verificados · eventos · 100% discreto</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 16, fontSize: 28, opacity: 0.95 }}>
          <div style={{ border: "3px solid white", borderRadius: 12, padding: "4px 14px", fontWeight: 800 }}>18+</div>
          <div>Somente para maiores de 18 anos</div>
        </div>
      </div>
    ),
    size,
  );
}
