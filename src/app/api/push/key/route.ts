import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { vapidKeys } from "@/server/push";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "login" }, { status: 401 });
  return NextResponse.json({ publicKey: (await vapidKeys()).publicKey });
}
