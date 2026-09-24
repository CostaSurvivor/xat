import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { resolveMediaAccess, type MediaVariant } from "@/server/access";
import { storage } from "@/server/storage";

const HEADERS = { "Cache-Control": "private, max-age=600", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("login", { status: 401 });
  const { id } = await params;
  const v = (new URL(req.url).searchParams.get("v") || "d") as MediaVariant;
  if (!["d", "b", "o", "v"].includes(v)) return new NextResponse("bad", { status: 400 });
  const r = await resolveMediaAccess(user, id, v);
  if (!r) return new NextResponse(v === "v" ? "assinantes" : "not found", { status: v === "v" ? 403 : 404 });

  try {
    // Vídeo (e original de vídeo): streaming com suporte a Range
    if (r.media.kind === "POST_VIDEO" && (r.variant === "v" || r.variant === "o")) {
      const key = r.media.originalKey;
      const size = await storage.size(key);
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
      let start = 0;
      let end = size - 1;
      if (range) {
        if (range[1]) start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), size - 1);
        if (!range[1] && range[2]) { start = Math.max(0, size - Number(range[2])); end = size - 1; }
        if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        end = Math.min(end, start + 4 * 1024 * 1024 - 1); // pedaços de até 4 MB
      }
      return new NextResponse(storage.stream(key, start, end), {
        status: range ? 206 : 200,
        headers: {
          ...HEADERS,
          "Content-Type": r.media.mime,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
        },
      });
    }
    const key = r.variant === "o" ? r.media.originalKey : r.variant === "b" ? r.media.blurKey : r.media.displayKey;
    const buf = await storage.get(key);
    return new NextResponse(new Uint8Array(buf), { headers: { ...HEADERS, "Content-Type": "image/webp", "X-Media-Variant": r.variant } });
  } catch {
    return new NextResponse("missing", { status: 404 });
  }
}
