import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL, cleanRefNick } from "@/lib/referral";

/** Link de convite: guarda quem convidou por 30 dias e leva para a página inicial (com a promoção). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nick: string }> }) {
  const nick = cleanRefNick(decodeURIComponent((await params).nick));
  const res = NextResponse.redirect(new URL("/", req.url));
  if (nick)
    res.cookies.set(REFERRAL.cookie, nick, { httpOnly: true, sameSite: "lax", path: "/", maxAge: REFERRAL.cookieDays * 86400, secure: req.nextUrl.protocol === "https:" });
  return res;
}
