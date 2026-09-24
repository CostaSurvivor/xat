import { NextResponse, type NextRequest } from "next/server";

/** Age gate: nada é exibido antes do aceite 18+ (cookie). */
const OPEN = ["/entrada", "/termos", "/privacidade", "/_next", "/favicon", "/robots.txt", "/api/public", "/hero", "/logo", "/icon"];

/** Cookie de dispositivo persistente (usado para banimento por dispositivo). */
function withDevice(req: NextRequest, res: NextResponse) {
  if (!req.cookies.get("did")) {
    res.cookies.set("did", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 730, secure: req.nextUrl.protocol === "https:" });
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return withDevice(req, NextResponse.next());
  if (req.cookies.get("age_ok")?.value === "1") return withDevice(req, NextResponse.next());
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "age_gate" }, { status: 403 });
  const url = req.nextUrl.clone();
  url.pathname = "/entrada";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
