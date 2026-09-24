import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { inbox } from "@/server/pm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  return NextResponse.json({ list: await inbox(user) });
}
