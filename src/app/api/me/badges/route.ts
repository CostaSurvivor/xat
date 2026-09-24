import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ notif: 0, pm: 0 });
  const [notif, convs] = await Promise.all([
    db.notification.count({ where: { userId: u.id, readAt: null } }),
    db.conversation.findMany({ where: { OR: [{ userAId: u.id }, { userBId: u.id }] }, select: { userAId: true, lastMessageAt: true, lastSenderId: true, aReadAt: true, bReadAt: true } }),
  ]);
  const pm = convs.filter((c) => {
    if (!c.lastSenderId || c.lastSenderId === u.id) return false;
    const read = c.userAId === u.id ? c.aReadAt : c.bReadAt;
    return !read || read < c.lastMessageAt;
  }).length;
  return NextResponse.json({ notif, pm });
}
