import { NextResponse } from "next/server";
import { safeNext } from "@/lib/oauth";
import { getCurrentUser } from "@/server/auth";
import { googleEnabled, publicOrigin, startFlow } from "@/server/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleEnabled()) return NextResponse.redirect(`${await publicOrigin()}/login?erro=google-off`);
  const mode = url.searchParams.get("modo") === "vincular" ? "link" : "login";
  if (mode === "link" && !(await getCurrentUser())) return NextResponse.redirect(`${await publicOrigin()}/login`);
  return NextResponse.redirect(await startFlow(safeNext(url.searchParams.get("next")), mode));
}
