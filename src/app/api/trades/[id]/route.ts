import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { tradeView } from "@/server/trades";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const v = await tradeView((await params).id, user.id);
  if (!v) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(v);
}
