import { z } from "zod";
import type { CSSProperties } from "react";

/**
 * Itens cosméticos. O admin configura via JSON TIPADO; o CSS é gerado aqui a
 * partir de primitivas validadas (cores #hex e animações de lista fixa).
 * Nada de CSS vindo de input livre — protege contra XSS/CSS injection.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const anim = z.enum(["none", "pulse", "rainbow", "shift", "flicker"]);

export const BADGE_EMOJIS = ["👑", "🔥", "💎", "⛓️", "🎭", "🌶️", "💋", "🍑", "🍒", "😈", "⭐", "🦋", "🐍", "🍾", "🗝️", "💜"] as const;

export const itemConfigSchemas = {
  GLOW: z.object({ colors: z.array(hex).min(1).max(4), animation: anim.default("none") }),
  NICK_COLOR: z.object({ colors: z.array(hex).min(1).max(3) }),
  TEXT_COLOR: z.object({ color: hex }),
  BADGE: z.object({ emoji: z.enum(BADGE_EMOJIS) }),
  AVATAR_FRAME: z.object({ colors: z.array(hex).min(1).max(4), animation: anim.default("none") }),
  ENTRY_EFFECT: z.object({ effect: z.enum(["sparkle", "fire", "hearts", "gold"]), message: z.string().max(40).optional() }),
  POWER: z.object({ power: z.enum(["INVISIBLE", "BIG_NICK", "HIGHLIGHT_ONLINE", "PRIORITY_PM"]) }),
} as const;

export type ItemCategoryKey = keyof typeof itemConfigSchemas;

export function parseItemConfig(category: ItemCategoryKey, config: unknown) {
  return itemConfigSchemas[category].safeParse(config);
}

export type ActiveItem = { category: string; config: unknown; powerScore: number };

export type NickStyle = {
  nick: CSSProperties;
  nickClass: string;
  text?: CSSProperties;
  badges: string[];
  frame?: CSSProperties;
  frameClass: string;
  entry?: { effect: string; message?: string };
  powers: Set<string>;
  power: number;
};

const ANIM_CLASS: Record<string, string> = {
  none: "",
  pulse: "fx-pulse",
  rainbow: "fx-rainbow",
  shift: "fx-shift",
  flicker: "fx-flicker",
};

/** Compila os itens ativos do usuário em estilos React seguros. */
export function compileStyle(items: ActiveItem[]): NickStyle {
  const s: NickStyle = { nick: {}, nickClass: "", badges: [], frameClass: "", powers: new Set(), power: 0 };
  for (const it of items) {
    const cat = it.category as ItemCategoryKey;
    if (!(cat in itemConfigSchemas)) continue;
    const r = parseItemConfig(cat, it.config);
    if (!r.success) continue;
    s.power += it.powerScore;
    const c = r.data as Record<string, any>;
    switch (cat) {
      case "GLOW": {
        const cols: string[] = c.colors;
        s.nick.textShadow = cols.map((col, i) => `0 0 ${4 + i * 4}px ${col}`).join(", ");
        s.nickClass += " " + ANIM_CLASS[c.animation];
        break;
      }
      case "NICK_COLOR": {
        const cols: string[] = c.colors;
        if (cols.length === 1) s.nick.color = cols[0];
        else {
          s.nick.backgroundImage = `linear-gradient(90deg, ${cols.join(", ")})`;
          s.nick.WebkitBackgroundClip = "text";
          s.nick.backgroundClip = "text";
          s.nick.color = "transparent";
        }
        break;
      }
      case "TEXT_COLOR":
        s.text = { color: c.color };
        break;
      case "BADGE":
        if (s.badges.length < 3) s.badges.push(c.emoji);
        break;
      case "AVATAR_FRAME": {
        const cols: string[] = c.colors;
        s.frame = { boxShadow: `0 0 0 2px ${cols[0]}, 0 0 10px 2px ${cols[cols.length - 1]}` };
        s.frameClass = ANIM_CLASS[c.animation];
        break;
      }
      case "ENTRY_EFFECT":
        s.entry = { effect: c.effect, message: c.message };
        break;
      case "POWER":
        s.powers.add(c.power);
        if (c.power === "BIG_NICK") s.nick.fontSize = "1.15em";
        if (c.power === "BIG_NICK") s.nick.fontWeight = 800;
        break;
    }
  }
  s.nickClass = s.nickClass.trim();
  return s;
}

/** Forma serializável (para enviar do servidor ao cliente). */
export function serializeStyle(s: NickStyle) {
  return { ...s, powers: [...s.powers] };
}
export type NickStyleJSON = ReturnType<typeof serializeStyle>;
