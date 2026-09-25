import Link from "next/link";

export function PaqueraTabs({ active, likes }: { active: "paquera" | "curtidas" | "matches"; likes?: number }) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-sm ${active === key ? "bg-wine2 text-white" : "border border-line text-mute"}`}>{label}</Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {tab("paquera", "/paquera", "💘 Paquera")}
      {tab("curtidas", "/paquera/curtidas", `Quem curtiu${likes ? ` (${likes})` : ""}`)}
      {tab("matches", "/paquera/matches", "Matches")}
    </div>
  );
}
