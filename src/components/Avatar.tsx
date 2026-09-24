import type { NickStyleJSON } from "@/lib/items";

export function Avatar({ mediaId, nick, size = 40, style }: { mediaId?: string | null; nick: string; size?: number; style?: NickStyleJSON }) {
  return (
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
}
