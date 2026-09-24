import { NextResponse } from "next/server";
import { UFS } from "@/lib/config";
import { citiesOf } from "@/lib/geo";

/** Lista de municípios de uma UF (sugestões do campo cidade). Dado público do IBGE. */
export function GET(req: Request) {
  const uf = new URL(req.url).searchParams.get("uf") ?? "";
  if (!UFS.includes(uf)) return NextResponse.json({ error: "UF inválida" }, { status: 400 });
  return NextResponse.json(citiesOf(uf), { headers: { "Cache-Control": "public, max-age=86400, immutable" } });
}
