import { NextResponse } from "next/server";
import { getHeroImage } from "@/server/settings";
import { storage } from "@/server/storage";

/** Fundo da tela inicial (público: aparece antes do login). */
export async function GET() {
  const hero = await getHeroImage();
  if (!hero) return new NextResponse("none", { status: 404 });
  try {
    const buf = await storage.get(hero.key);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new NextResponse("missing", { status: 404 });
  }
}
