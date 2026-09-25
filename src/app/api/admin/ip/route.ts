import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { clientInfo, getCurrentUser } from "@/server/auth";

/** Diagnóstico (só admin): como o proxy da hospedagem entrega o IP, para ajustar TRUSTED_PROXY_HOPS. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const h = await headers();
  const { ip } = await clientInfo();
  return NextResponse.json({
    resolved: ip,
    hops: Number(process.env.TRUSTED_PROXY_HOPS || 1),
    xForwardedFor: h.get("x-forwarded-for"),
    xRealIp: h.get("x-real-ip"),
    forwarded: h.get("forwarded"),
    cfConnectingIp: h.get("cf-connecting-ip"),
  });
}
