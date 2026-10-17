import type { NickStyleJSON } from "@/lib/items";

export function Avatar({ mediaId, nick, size = 40, style, ring }: { mediaId?: string | null; nick: string; size?: number; style?: NickStyleJSON; ring?: "vip" | "live" | null }) {
  const inner = (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-wine to-ink text-gold ${style?.frameClass ?? ""}`}
      style={{ width: size, height: size, ...(style?.frame ?? {}) }}
    >
      {mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${mediaId}?v=d`} alt="" className="protected-img h-full w-full object-cover" draggable={false} />
      ) : (
        <span style={{ fontSize: size * 0.42 }} className="font-bold uppercase">{nick.slice(0, 1)}</span>
      )}
    </span>
  );
  if (!ring) return inner;
  // anel de status: dourado com coroa para assinantes, verde com LIVE para quem transmite
  return (
    <span className={`relative inline-flex shrink-0 rounded-full p-[2px] ${ring === "vip" ? "bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600" : "bg-green-500"}`} data-testid={`anel-${ring}`}>
      <span className="rounded-full bg-panel p-[1.5px]">{inner}</span>
      {ring === "vip" && <span className="absolute -right-1 -top-1.5 text-[13px] leading-none drop-shadow" title="Assinante" aria-label="Assinante">👑</span>}
      {ring === "live" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-green-600 px-1 text-[8px] font-bold uppercase text-white">Live</span>}
    </span>
  );
}
