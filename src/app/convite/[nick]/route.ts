import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL, cleanRefNick } from "@/lib/referral";

/** Link de convite: guarda quem convidou por 30 dias e leva para a página inicial (com a promoção). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nick: string }> }) {
  let raw = "";
  try { raw = decodeURIComponent((await params).nick); } catch {}
  const nick = cleanRefNick(raw);
  // Location relativa: atrás do proxy da hospedagem, req.url traz o endereço interno (0.0.0.0:3000)
  const res = new NextResponse(null, { status: 307, headers: { Location: "/" } });
  // o primeiro convite vale: outro site não consegue trocar quem convidou
  if (nick && !req.cookies.get(REFERRAL.cookie))
    res.cookies.set(REFERRAL.cookie, nick, { httpOnly: true, sameSite: "lax", path: "/", maxAge: REFERRAL.cookieDays * 86400, secure: req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:" });
  return res;
}
