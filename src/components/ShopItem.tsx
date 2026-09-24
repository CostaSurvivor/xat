"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purchaseItem } from "@/app/actions/shop";
import { compileStyle, serializeStyle } from "@/lib/items";
import { CURRENCY_ICON } from "@/lib/config";
import { Nick } from "./Nick";
import { Avatar } from "./Avatar";
import { RoleIcon } from "./RoleIcon";

type Item = { id: string; name: string; description: string | null; category: string; rarity: string; config: unknown; powerScore: number; price7: number | null; price30: number | null; pricePerm: number | null; soldOut: boolean; left: number | null; owned?: string | null };

const RARITY: Record<string, string> = { COMMON: "text-mute", RARE: "text-sky-300", EPIC: "text-fuchsia-300", LEGENDARY: "text-gold", LIMITED: "text-red-300" };
const RARITY_PT: Record<string, string> = { COMMON: "comum", RARE: "raro", EPIC: "épico", LEGENDARY: "lendário", LIMITED: "edição limitada" };
const POWER_PT: Record<string, string> = { INVISIBLE: "👻 some da lista de online", BIG_NICK: "🔠 nick maior no chat", HIGHLIGHT_ONLINE: "✨ destaque na lista de online", PRIORITY_PM: "⚡ PV no topo da caixa" };
const ENTRY_PT: Record<string, string> = { fire: "🔥 entrada em chamas", gold: "👑 entrada real", hearts: "💞 entrada com corações", sparkle: "✨ entrada brilhante" };

export function ShopItem({ item, nick, avatarId, canBuy }: { item: Item; nick: string; avatarId: string | null; canBuy: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [gift, setGift] = useState("");
  const [showGift, setShowGift] = useState(false);
  const [pending, start] = useTransition();
  const idem = useRef(crypto.randomUUID());
  const style = serializeStyle(compileStyle([{ category: item.category, config: item.config, powerScore: item.powerScore }]));
  const cfg = item.config as Record<string, string>;

  const buy = (d: "7" | "30" | "perm") =>
    start(async () => {
      const r = await purchaseItem(item.id, d, showGift && gift ? gift.replace(/^@/, "") : undefined, idem.current);
      setMsg(r.ok ? (showGift ? "Presente enviado! 🎁" : "Comprado! Ative no inventário.") : r.error ?? "Erro");
      if (r.ok) { idem.current = crypto.randomUUID(); router.refresh(); }
    });

  return (
    <div className={`card relative flex flex-col p-4 ${item.owned ? "border-green-600/50" : ""}`}>
      {item.owned && <span className="absolute right-2 top-2 z-10 rounded-full bg-green-900/80 px-2 py-0.5 text-[10px] text-green-200">✔ Você tem · {item.owned}</span>}
      <div className="mb-3 flex h-20 items-center justify-center gap-3 rounded-xl bg-ink/70">
        {item.category === "AVATAR_FRAME" && <Avatar mediaId={avatarId} nick={nick} size={48} style={style} />}
        {item.category === "DOLL" ? (
          <span className="flex items-center gap-2"><RoleIcon role="MEMBER" size={56} accessory={cfg.accessory} /><Nick nick={nick} link={false} /></span>
        ) : item.category === "TEXT_COLOR" ? (
          <span><Nick nick={nick} link={false} />: <span style={style.text}>Oi, tudo bem? 😘</span></span>
        ) : item.category === "POWER" ? (
          <span className="px-2 text-center text-sm">{POWER_PT[cfg.power]}</span>
        ) : item.category === "ENTRY_EFFECT" ? (
          <span className="entry-pop text-sm">{ENTRY_PT[cfg.effect]}</span>
        ) : (
          <span className="text-lg"><Nick nick={nick} style={style} link={false} /></span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{item.name}</h3>
        <span className={`text-[11px] uppercase ${RARITY[item.rarity]}`}>{RARITY_PT[item.rarity]}</span>
      </div>
      {item.description && <p className="text-xs text-mute">{item.description}</p>}
      {item.left !== null && <p className="text-xs text-red-300">{item.soldOut ? "Esgotado" : `Restam ${item.left}`}</p>}
      {item.pricePerm != null && <p className="text-[10px] text-mute">Permanente = pode ser trocado com outros usuários</p>}
      <div className="mt-auto space-y-2 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {item.price7 != null && <button disabled={!canBuy || pending || item.soldOut} onClick={() => buy("7")} className="btn-ghost px-3 py-1 text-xs">7d · {CURRENCY_ICON}{item.price7}</button>}
          {item.price30 != null && <button disabled={!canBuy || pending || item.soldOut} onClick={() => buy("30")} className="btn-wine px-3 py-1 text-xs">30d · {CURRENCY_ICON}{item.price30}</button>}
          {item.pricePerm != null && <button disabled={!canBuy || pending || item.soldOut} onClick={() => buy("perm")} className="btn-gold px-3 py-1 text-xs">∞ · {CURRENCY_ICON}{item.pricePerm}</button>}
        </div>
        <label className="flex items-center gap-1 text-xs text-mute"><input type="checkbox" checked={showGift} onChange={(e) => setShowGift(e.target.checked)} /> Dar de presente</label>
        {showGift && <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="@nick de quem vai receber" className="input py-1 text-xs" />}
        {msg && <p className="text-xs text-gold">{msg}</p>}
      </div>
    </div>
  );
}
