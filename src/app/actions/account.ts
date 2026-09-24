"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { destroySession, requireUser, verifyPassword } from "@/server/auth";
import { storage } from "@/server/storage";
import { audit } from "@/server/notify";

/**
 * Exclusão de conta (LGPD art. 18, VI). Apaga perfil, fotos, posts e mensagens.
 * Mantém: ledger/pagamentos (obrigação fiscal), AccessLog (Marco Civil, 6 meses)
 * e evidências de denúncias escaladas. O usuário vira um registro anonimizado.
 */
export async function deleteAccount(_: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  if (!(await verifyPassword(user.passwordHash, String(formData.get("password") || "")))) return { error: "Senha incorreta" };
  if (formData.get("confirm") !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar" };

  const escalated = await db.report.findMany({ where: { targetUserId: user.id, status: "ESCALATED" } });
  const keepMedia = new Set(
    escalated.flatMap((r) => {
      const ev = r.evidence as { media?: string[]; mediaId?: string | null } | null;
      return [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
    }),
  );
  const media = await db.media.findMany({ where: { ownerId: user.id } });
  for (const m of media) {
    if (keepMedia.has(m.id)) continue;
    await Promise.all([storage.remove(m.originalKey), storage.remove(m.displayKey), storage.remove(m.blurKey)]);
  }
  const anon = `removido_${randomBytes(4).toString("hex")}`;
  await db.$transaction([
    db.post.deleteMany({ where: { authorId: user.id } }),
    db.postComment.deleteMany({ where: { authorId: user.id } }),
    db.postReaction.deleteMany({ where: { userId: user.id } }),
    db.privateMessage.deleteMany({ where: { senderId: user.id } }),
    db.message.updateMany({ where: { authorId: user.id }, data: { deletedAt: new Date(), body: "[removido]" } }),
    db.media.deleteMany({ where: { ownerId: user.id, id: { notIn: [...keepMedia] } } }),
    db.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followeeId: user.id }] } }),
    db.albumAccess.deleteMany({ where: { OR: [{ ownerId: user.id }, { viewerId: user.id }] } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.roomPresence.deleteMany({ where: { userId: user.id } }),
    db.roomMember.deleteMany({ where: { userId: user.id } }),
    db.inventoryItem.deleteMany({ where: { userId: user.id } }),
    db.profilePerson.deleteMany({ where: { userId: user.id } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: { status: "DELETED", email: `${anon}@deleted.invalid`, nick: anon, bio: null, city: null, likes: [], avatarId: null, passwordHash: "!" },
    }),
  ]);
  await audit(user.id, "account.delete", "User", user.id);
  await destroySession();
  redirect("/entrada");
}

export async function changePassword(_: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  if (!(await verifyPassword(user.passwordHash, current))) return { error: "Senha atual incorreta" };
  if (next.length < 8) return { error: "A nova senha precisa ter 8+ caracteres" };
  if (next !== String(formData.get("confirm") || "")) return { error: "As senhas não conferem" };
  const { hashPassword, sha256 } = await import("@/server/auth");
  const { cookies } = await import("next/headers");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // encerra as outras sessões (mantém a atual)
  const token = (await cookies()).get("sid")?.value;
  await db.session.deleteMany({ where: { userId: user.id, NOT: { tokenHash: token ? sha256(token) : "" } } });
  await audit(user.id, "account.password", "User", user.id);
  return { ok: true };
}
