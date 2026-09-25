import "server-only";
import { db } from "@/lib/db";
import { isCouple } from "@/lib/config";
import { isStaff, isVerified, type CurrentUser } from "./auth";
import { isBlockedBetween } from "./access";
import { stylesFor } from "./styles";
import { AUDIO_NEEDS_REPLY, voiceClock } from "@/lib/voice";

export const pairOf = (a: string, b: string) => (a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a });

export async function findConversation(a: string, b: string) {
  return db.conversation.findUnique({ where: { userAId_userBId: pairOf(a, b) } });
}

/** Regras de PV do destinatário (quem pode me chamar). */
export async function canMessage(sender: CurrentUser, recipient: { id: string; pmPolicy: string; status: string }) {
  if (recipient.status !== "ACTIVE") return "Usuário indisponível.";
  if (sender.id === recipient.id) return "Não dá para mandar PV para si mesmo.";
  if (await isBlockedBetween(sender.id, recipient.id)) return "Usuário indisponível.";
  if (isStaff(sender)) return null;
  if (!isVerified(sender)) return "Verifique seu perfil (selfie) para conversar no PV.";
  // se o destinatário já me respondeu antes, a conversa está liberada
  const conv = await findConversation(sender.id, recipient.id);
  if (conv && (await db.privateMessage.count({ where: { conversationId: conv.id, senderId: recipient.id } })) > 0) return null;
  switch (recipient.pmPolicy) {
    case "NOBODY":
      return "Este perfil não está aceitando PV.";
    case "FRIENDS": {
      const { areFriends } = await import("./friends");
      return (await areFriends(sender.id, recipient.id)) ? null : "Este perfil só aceita PV de amigos.";
    }
    case "FOLLOWING": {
      const f = await db.follow.findUnique({ where: { followerId_followeeId: { followerId: recipient.id, followeeId: sender.id } } });
      return f ? null : "Este perfil só aceita PV de quem ele segue.";
    }
    case "COUPLES":
      return isCouple(sender.profileType) ? null : "Este perfil só aceita PV de casais.";
  }
  return null;
}

/** Foto no PV: os dois precisam ter habilitado e ser verificados. */
export function canSendPhoto(sender: CurrentUser, recipient: { acceptPmPhotos: boolean; ageVerification: string }) {
  if (!isVerified(sender)) return "Verifique seu perfil para enviar fotos.";
  if (!sender.acceptPmPhotos) return "Ative “aceito fotos no PV” no seu perfil para enviar fotos.";
  if (!recipient.acceptPmPhotos || recipient.ageVerification !== "APPROVED") return "Este perfil não aceita fotos no PV.";
  return null;
}

/**
 * Áudio no PV: além das regras do PV, só depois que a outra pessoa já respondeu
 * (ninguém recebe áudio de quem nunca conversou com ela).
 */
export async function canSendAudio(sender: CurrentUser, recipientId: string) {
  if (isStaff(sender)) return null;
  if (!isVerified(sender)) return "Verifique seu perfil para enviar áudios.";
  const conv = await findConversation(sender.id, recipientId);
  const replied = conv ? await db.privateMessage.count({ where: { conversationId: conv.id, senderId: recipientId } }) : 0;
  return replied > 0 ? null : AUDIO_NEEDS_REPLY;
}

export async function pmMessages(convId: string, viewerId: string, after?: bigint) {
  const rows = await db.privateMessage.findMany({
    where: { conversationId: convId, ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: after ? "asc" : "desc" },
    take: after ? 100 : 80,
  });
  if (!after) rows.reverse();
  return rows.map((m) => ({
    id: m.id.toString(),
    mine: m.senderId === viewerId,
    body: m.body,
    mediaId: m.mediaId,
    audioSecs: m.audioSecs,
    revealed: !!m.revealedAt,
    createdAt: m.createdAt.toISOString(),
  }));
}
export type PmMessage = Awaited<ReturnType<typeof pmMessages>>[number];

export async function markRead(convId: string, userId: string) {
  const c = await db.conversation.findUnique({ where: { id: convId } });
  if (!c) return;
  await db.conversation.update({ where: { id: convId }, data: c.userAId === userId ? { aReadAt: new Date() } : { bReadAt: new Date() } });
}

export type InboxItem = Awaited<ReturnType<typeof inbox>>[number];

export async function inbox(user: CurrentUser) {
  const convs = await db.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { messages: { orderBy: { id: "desc" }, take: 1 } },
  });
  const otherIds = convs.map((c) => (c.userAId === user.id ? c.userBId : c.userAId));
  const [users, styles] = await Promise.all([
    db.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, nick: true, avatarId: true, status: true, lastSeenAt: true } }),
    stylesFor(otherIds),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const list = convs
    .map((c) => {
      const otherId = c.userAId === user.id ? c.userBId : c.userAId;
      const other = byId.get(otherId);
      const read = c.userAId === user.id ? c.aReadAt : c.bReadAt;
      const last = c.messages[0];
      return other && other.status === "ACTIVE"
        ? {
            id: c.id,
            other: { id: other.id, nick: other.nick, avatarId: other.avatarId, style: styles[otherId], online: !!other.lastSeenAt && Date.now() - other.lastSeenAt.getTime() < 5 * 60_000 },
            last: last ? (last.audioSecs != null ? `🎤 Áudio (${voiceClock(last.audioSecs)})` : last.mediaId ? "📷 Foto" : last.body ?? "") : "",
            lastMine: last?.senderId === user.id,
            lastAt: c.lastMessageAt.toISOString(),
            unread: !!c.lastSenderId && c.lastSenderId !== user.id && (!read || read < c.lastMessageAt),
            priority: styles[otherId]?.powers.includes("PRIORITY_PM") ?? false,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  // PV prioritário: conversas não lidas de quem tem o poder sobem ao topo
  return list.sort((a, b) => Number(b.unread && b.priority) - Number(a.unread && a.priority));
}
