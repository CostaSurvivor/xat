import "server-only";
import { db } from "@/lib/db";

export type FriendStatus = "none" | "sent" | "received" | "friends";

export async function friendStatus(viewerId: string, otherId: string): Promise<FriendStatus> {
  if (viewerId === otherId) return "none";
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: viewerId, addresseeId: otherId }, { requesterId: otherId, addresseeId: viewerId }] },
  });
  if (rows.some((r) => r.status === "ACCEPTED")) return "friends";
  if (rows.some((r) => r.requesterId === viewerId)) return "sent";
  if (rows.some((r) => r.requesterId === otherId)) return "received";
  return "none";
}

export async function areFriends(a: string, b: string) {
  return (await friendStatus(a, b)) === "friends";
}

export async function friendIds(userId: string) {
  const rows = await db.friendship.findMany({ where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] } });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}
