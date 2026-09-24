"use client";

import { compileStyle, serializeStyle } from "@/lib/items";
import { RoleIcon } from "./RoleIcon";

const RARITY_RING: Record<string, string> = { COMMON: "border-line", RARE: "border-sky-400/60", EPIC: "border-fuchsia-400/60", LEGENDARY: "border-gold", LIMITED: "border-red-400/70" };

/** Miniatura de um item (usada em trocas e inventário). */
export function ItemBadge({ name, category, rarity, config, nick = "Nick", small = false }: { name: string; category: string; rarity: string; config: unknown; nick?: string; small?: boolean }) {
  const st = serializeStyle(compileStyle([{ category, config, powerScore: 0 }]));
  const cfg = config as Record<string, string>;
  const preview =
    category === "DOLL" ? <RoleIcon role="MEMBER" size={small ? 26 : 34} accessory={cfg.accessory} /> :
    category === "BADGE" ? <span className="text-xl">{cfg.emoji}</span> :
    category === "POWER" ? <span className="text-lg">⚡</span> :
    category === "ENTRY_EFFECT" ? <span className="text-lg">🎉</span> :
    category === "AVATAR_FRAME" ? <span className="inline-block h-6 w-6 rounded-full bg-wine" style={st.frame} /> :
    <span style={{ ...st.nick, ...(st.text ?? {}) }} className={`text-sm font-bold ${st.nickClass}`}>{nick}</span>;
  return (
    <div className={`flex items-center gap-2 rounded-xl border bg-panel2 px-2 py-1.5 ${RARITY_RING[rarity] ?? "border-line"}`}>
      <span className="flex min-w-8 justify-center">{preview}</span>
      <span className={`${small ? "text-xs" : "text-sm"} leading-tight`}>{name}</span>
    </div>
  );
}
