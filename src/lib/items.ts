import { z } from "zod";
import type { CSSProperties } from "react";

/**
 * Itens cosméticos. O admin configura via JSON TIPADO; o CSS é gerado aqui a
 * partir de primitivas validadas (cores #hex e animações de lista fixa).
 * Nada de CSS vindo de input livre — protege contra XSS/CSS injection.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const anim = z.enum(["none", "pulse", "rainbow", "shift", "flicker", "neon"]);
export const DOLL_KINDS = ["cowboy", "horns", "cuckqueen", "wand", "tophat", "halo", "devil", "bunny", "mask", "whip", "champagne", "gaucho", "chimarrao"] as const;

export const BADGE_EMOJIS = ["👑", "🔥", "💎", "⛓️", "🎭", "🌶️", "💋", "🍑", "🍒", "😈", "⭐", "🦋", "🐍", "🍾", "🗝️", "💜", "🧉"] as const;

export const itemConfigSchemas = {
  DOLL: z.object({ accessory: z.enum(DOLL_KINDS) }),
  GLOW: z.object({ colors: z.array(hex).min(1).max(4), animation: anim.default("none") }),
  NICK_COLOR: z.object({ colors: z.array(hex).min(1).max(3) }),
  TEXT_COLOR: z.object({ color: hex }),
  BADGE: z.object({ emoji: z.enum(BADGE_EMOJIS) }),
  AVATAR_FRAME: z.object({ colors: z.array(hex).min(1).max(4), animation: anim.default("none") }),
  ENTRY_EFFECT: z.object({ effect: z.enum(["sparkle", "fire", "hearts", "gold"]), message: z.string().max(40).optional() }),
  POWER: z.object({ power: z.enum(["INVISIBLE", "BIG_NICK", "HIGHLIGHT_ONLINE", "PRIORITY_PM", "PIN_MESSAGE"]) }),
} as const;

export type ItemCategoryKey = keyof typeof itemConfigSchemas;

export function parseItemConfig(category: ItemCategoryKey, config: unknown) {
  return itemConfigSchemas[category].safeParse(config);
}

/** Tempo que a mensagem fixada pelo poder fica no topo da sala. */
export const PIN_POWER_MINUTES = 10;

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
  founder?: boolean;
  vip?: boolean;
  doll?: string;
};

const ANIM_CLASS: Record<string, string> = {
  none: "",
  pulse: "fx-pulse",
  rainbow: "fx-rainbow",
  shift: "fx-shift",
  flicker: "fx-flicker",
  neon: "fx-neon",
};

/** Escurece uma cor #rrggbb (já validada) para ficar legível no fundo branco. */
export function darken(hex: string, amount = 0.45) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Contraste WCAG de uma cor #rrggbb contra o branco (1 a 21). */
export function contrastOnWhite(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05);
}

/**
 * Garante leitura no fundo claro: escurece a cor (mantendo o tom) até atingir o contraste mínimo.
 * Assim itens comprados para o tema escuro (champagne, dourado, amarelo…) continuam legíveis.
 */
export function readable(hex: string, min = 4.5) {
  const c = hex.toLowerCase();
  if (contrastOnWhite(c) >= min) return c;
  // reduz só a luminosidade (HSL): o tom e a saturação ficam, a cor só "escurece"
  const n = parseInt(c.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0;
  const d = max - mn;
  let l = (max + mn) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  const toHex = (L: number) => {
    const C = (1 - Math.abs(2 * L - 1)) * sat, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
    const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return "#" + [r1, g1, b1].map((v) => Math.min(255, Math.max(0, Math.round((v + m) * 255))).toString(16).padStart(2, "0")).join("");
  };
  let out = c;
  while (l > 0 && contrastOnWhite(out) < min) { l = Math.max(0, l - 0.02); out = toHex(l); }
  return out;
}

/** Compila os itens ativos do usuário em estilos React seguros. */
export function compileStyle(items: ActiveItem[]): NickStyle {
  const s: NickStyle = { nick: {}, nickClass: "", badges: [], frameClass: "", powers: new Set(), power: 0 };
  let glowColor: string | null = null;
  for (const it of items) {
    const cat = it.category as ItemCategoryKey;
    if (!(cat in itemConfigSchemas)) continue;
    const r = parseItemConfig(cat, it.config);
    if (!r.success) continue;
    s.power += it.powerScore;
    const c = r.data as Record<string, any>;
    switch (cat) {
      case "GLOW": {
        // neon no fundo claro: texto na cor do brilho (escurecida, legível) + halos suaves
        const cols: string[] = c.colors;
        const main = cols[0];
        const second = cols[cols.length - 1];
        glowColor = readable(main, 3.5);
        // halo suave: forte demais "lava" a letra no fundo branco
        s.nick.textShadow = [
          `0 0 3px ${main}66`,
          `0 0 8px ${main}55`,
          `0 0 14px ${second}44`,
          ...(cols.length > 2 ? [`0 0 20px ${cols[1]}33`] : []),
        ].join(", ");
        s.nickClass += " " + ANIM_CLASS[c.animation];
        break;
      }
      case "DOLL":
        s.doll = c.accessory;
        break;
      case "NICK_COLOR": {
        const cols: string[] = c.colors;
        // nick é negrito: contraste mínimo 3.5; cada cor do degradê também
        if (cols.length === 1) s.nick.color = readable(cols[0], 3.5);
        else {
          s.nick.backgroundImage = `linear-gradient(90deg, ${cols.map((c) => readable(c, 3.5)).join(", ")})`;
          s.nick.WebkitBackgroundClip = "text";
          s.nick.backgroundClip = "text";
          s.nick.color = "transparent";
        }
        break;
      }
      case "TEXT_COLOR":
        s.text = { color: readable(c.color, 4.5) };
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
  // brilho sem cor de nick comprada: o nick assume a cor do brilho
  if (glowColor && !s.nick.color && !s.nick.backgroundImage) s.nick.color = glowColor;
  s.nickClass = s.nickClass.trim();
  return s;
}

/** Forma serializável (para enviar do servidor ao cliente). */
export function serializeStyle(s: NickStyle) {
  return { ...s, powers: [...s.powers] };
}
export type NickStyleJSON = ReturnType<typeof serializeStyle>;
