import { NextResponse, type NextRequest } from "next/server";

/** Age gate: nada é exibido antes do aceite 18+ (cookie). */
const OPEN = ["/entrada", "/termos", "/privacidade", "/_next", "/favicon", "/robots.txt"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.get("age_ok")?.value === "1") return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "age_gate" }, { status: 403 });
  const url = req.nextUrl.clone();
  url.pathname = "/entrada";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
