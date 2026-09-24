import Link from "next/link";
import type { NickStyleJSON } from "@/lib/items";

export function Nick({ nick, style, link = true, className = "" }: { nick: string; style?: NickStyleJSON; link?: boolean; className?: string }) {
  const inner = (
    <>
      <span style={style?.nick} className={`font-semibold ${style?.nickClass ?? ""}`}>{nick}</span>
      {style?.badges?.map((b, i) => <span key={i} className="ml-0.5 text-[0.9em]">{b}</span>)}
    </>
  );
  return link ? <Link href={`/u/${encodeURIComponent(nick)}`} className={`hover:underline ${className}`}>{inner}</Link> : <span className={className}>{inner}</span>;
}
