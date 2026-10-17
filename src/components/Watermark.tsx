"use client";

import { createContext, useContext } from "react";

/** Quem está vendo (nick) — preenchido no layout logado, usado na marca d'água das fotos. */
export const ViewerContext = createContext<string | null>(null);

export function ViewerProvider({ nick, children }: { nick: string; children: React.ReactNode }) {
  return <ViewerContext.Provider value={nick}>{children}</ViewerContext.Provider>;
}

/**
 * Marca d'água em diagonal com o nick de quem vê e a data: desestimula print e vazamento
 * (se a foto vazar, dá para saber de qual conta saiu). Fica por cima da imagem, sem bloquear cliques.
 */
export function Watermark({ dense = false }: { dense?: boolean }) {
  const nick = useContext(ViewerContext);
  if (!nick) return null;
  const date = new Date().toLocaleDateString("pt-BR");
  const text = `@${nick} · ${date}`;
  const rows = dense ? 6 : 3;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex select-none flex-col justify-around overflow-hidden" data-testid="marca-dagua">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="-rotate-[24deg] whitespace-nowrap text-center text-[11px] font-semibold tracking-wide text-white/[0.18] [text-shadow:0_0_2px_rgba(0,0,0,.35)]" style={{ marginLeft: i % 2 ? "-30%" : "-10%", width: "160%" }}>
          {`${text}    ${text}    ${text}`}
        </div>
      ))}
    </div>
  );
}
