import "server-only";
import { db } from "@/lib/db";
import { ROOM_POLL, isOpen, resultLine, tally } from "@/lib/roompolls";

/** Encerra (uma vez só) e publica o resultado na sala. */
export async function closePoll(pollId: string, roomId: string) {
  const done = await db.roomPoll.updateMany({ where: { id: pollId, roomId, closedAt: null }, data: { closedAt: new Date() } });
  if (!done.count) return false;
  const p = await db.roomPoll.findUnique({ where: { id: pollId }, include: { votes: { select: { option: true } } } });
  if (p) await db.message.create({ data: { roomId, kind: "SYSTEM", body: resultLine(p.question, p.options as string[], p.votes) } });
  return true;
}

/** Enquete para mostrar no topo: a aberta, ou a última encerrada há menos de 1 min (com o resultado). */
export async function roomPollView(roomId: string, userId: string) {
  const p = await db.roomPoll.findFirst({ where: { roomId }, orderBy: { createdAt: "desc" }, include: { votes: { select: { option: true, userId: true } } } });
  if (!p) return null;
  if (!p.closedAt && p.endsAt.getTime() <= Date.now()) {
    await closePoll(p.id, roomId);
    p.closedAt = new Date();
  }
  const open = isOpen(p);
  if (!open && Date.now() - (p.closedAt ?? p.endsAt).getTime() > ROOM_POLL.showClosedForMs) return null;
  const options = p.options as string[];
  const t = tally(p.votes, options.length);
  return {
    id: p.id,
    question: p.question,
    options,
    counts: t.counts,
    pct: t.pct,
    total: t.total,
    winners: open ? [] : t.winners,
    mine: p.votes.find((v) => v.userId === userId)?.option ?? null,
    open,
    endsAt: p.endsAt.toISOString(),
  };
}
