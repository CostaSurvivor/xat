import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { resolveMediaAccess, type MediaVariant } from "@/server/access";
import { storage } from "@/server/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("login", { status: 401 });
  const { id } = await params;
  const v = (new URL(req.url).searchParams.get("v") || "d") as MediaVariant;
  if (!["d", "b", "o"].includes(v)) return new NextResponse("bad", { status: 400 });
  const r = await resolveMediaAccess(user, id, v);
  if (!r) return new NextResponse("not found", { status: 404 });
  const key = r.variant === "o" ? r.media.originalKey : r.variant === "b" ? r.media.blurKey : r.media.displayKey;
  try {
    const buf = await storage.get(key);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=600",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "X-Media-Variant": r.variant,
      },
    });
  } catch {
    return new NextResponse("missing", { status: 404 });
  }
}
