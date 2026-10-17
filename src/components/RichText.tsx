import Link from "next/link";
import { segments } from "@/lib/richtext";

/** Texto com #hashtags (abre o feed filtrado) e @menções (abre o perfil) clicáveis. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((s, i) =>
        s.t === "text" ? (
          <span key={i}>{s.v}</span>
        ) : s.t === "tag" ? (
          <Link key={i} href={`/feed?tag=${encodeURIComponent(s.v.toLowerCase())}`} className="font-semibold text-wine hover:underline" data-testid="hashtag">#{s.v}</Link>
        ) : (
          <Link key={i} href={`/u/${encodeURIComponent(s.v)}`} className="font-semibold text-wine hover:underline">@{s.v}</Link>
        ),
      )}
    </>
  );
}
