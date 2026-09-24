"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { groupSchema, joinError } from "@/lib/groups";
import { requireStaff, requireUser } from "@/server/auth";
import { audit } from "@/server/notify";

type R = { ok?: boolean; error?: string } | undefined;

export async function joinGroup(groupId: string) {
  const user = await requireUser();
  const g = await db.group.findUnique({ where: { id: groupId } });
  if (!g) return { error: "Grupo não encontrado" };
  const err = joinError(g, user);
  if (err) return { error: err };
  await db.groupMember.upsert({ where: { groupId_userId: { groupId, userId: user.id } }, create: { groupId, userId: user.id }, update: {} });
  revalidatePath(`/grupos/${g.slug}`);
  revalidatePath("/grupos");
  return { ok: true };
}

export async function leaveGroup(groupId: string) {
  const user = await requireUser();
  const g = await db.group.findUnique({ where: { id: groupId }, select: { slug: true } });
  await db.groupMember.deleteMany({ where: { groupId, userId: user.id } });
  if (g) revalidatePath(`/grupos/${g.slug}`);
  revalidatePath("/grupos");
  return { ok: true };
}

/** Equipe do site cria grupos (usuários não criam, igual às salas). */
export async function adminCreateGroup(_: R, formData: FormData): Promise<R> {
  const staff = await requireStaff();
  const p = groupSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  if (await db.group.findUnique({ where: { slug: p.data.slug } })) return { error: "Já existe um grupo com esse endereço." };
  const g = await db.group.create({ data: { ...p.data, createdById: staff.id } });
  await audit(staff.id, "group.create", "Group", g.id);
  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  return { ok: true };
}

export async function adminGroupAction(groupId: string, formData: FormData) {
  const staff = await requireStaff();
  const op = String(formData.get("op"));
  if (op === "archive") await db.group.update({ where: { id: groupId }, data: { archivedAt: new Date() } });
  else if (op === "unarchive") await db.group.update({ where: { id: groupId }, data: { archivedAt: null } });
  else if (op === "edit") {
    const p = groupSchema.omit({ slug: true }).safeParse(Object.fromEntries(formData));
    if (!p.success) return;
    await db.group.update({ where: { id: groupId }, data: p.data });
  } else return;
  await audit(staff.id, `group.${op}`, "Group", groupId);
  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
}
