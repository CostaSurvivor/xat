"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { CURRENCY_NAME } from "@/lib/config";
import { itemConfigSchemas, type ItemCategoryKey } from "@/lib/items";
import { requireAdmin, requireStaff, sha256 } from "@/server/auth";
import { adminAdjust, creditPayment, grantVip } from "@/server/ledger";
import { audit, notify } from "@/server/notify";

// ---------------- Pagamentos (admin) ----------------
export async function approvePayment(paymentId: string) {
  const admin = await requireAdmin();
  const p = await creditPayment(paymentId, admin.id);
  await notify(p.userId, "COINS_CREDITED", p.kind === "VIP" ? `⭐ Assinatura ativada (${p.vipDays} dias)! Agora você assiste aos vídeos.` : `✅ Pix ${p.code} aprovado: +${p.coins} ${CURRENCY_NAME}!`);
  await audit(admin.id, "payment.approve", "Payment", paymentId);
  revalidatePath("/admin/pagamentos");
}

export async function rejectPayment(paymentId: string) {
  const admin = await requireAdmin();
  const p = await db.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() } });
  await notify(p.userId, "SYSTEM", `Pix ${p.code} não foi localizado. Se você pagou, fale com a administração.`);
  await audit(admin.id, "payment.reject", "Payment", paymentId);
  revalidatePath("/admin/pagamentos");
}

// ---------------- Verificações (staff) ----------------
export async function reviewVerification(id: string, approve: boolean, formData?: FormData) {
  const staff = await requireStaff();
  const v = await db.verificationRequest.findUnique({ where: { id } });
  if (!v || v.status !== "PENDING") return;
  const reason = String(formData?.get("reason") || "").slice(0, 255) || null;
  await db.verificationRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewerId: staff.id, reviewedAt: new Date(), rejectReason: approve ? null : reason } });
  await db.user.update({ where: { id: v.userId }, data: approve ? { ageVerification: "APPROVED", ageVerifiedAt: new Date() } : { ageVerification: "REJECTED" } });
  await notify(v.userId, "VERIFICATION", approve ? "✅ Perfil verificado! Fotos, PV com fotos, loja e criação de salas liberados." : `Verificação recusada${reason ? `: ${reason}` : ""}. Tente de novo.`);
  await audit(staff.id, approve ? "verification.approve" : "verification.reject", "User", v.userId, { reason });
  revalidatePath("/admin/verificacoes");
}

// ---------------- Denúncias (staff) ----------------
async function banUser(userId: string, actorId: string, reason: string, days: number | null) {
  const u = await db.user.update({ where: { id: userId }, data: { status: days ? "SUSPENDED" : "BANNED" } });
  await db.session.deleteMany({ where: { userId } });
  if (!days) {
    const ips = await db.accessLog.findMany({ where: { userId }, distinct: ["ip"], select: { ip: true }, take: 10 });
    const expiresAt = null;
    await db.banFingerprint.createMany({
      data: [{ kind: "EMAIL", valueHash: sha256(u.email), reason, expiresAt }, ...ips.map((i) => ({ kind: "IP", valueHash: sha256(i.ip), reason, expiresAt: new Date(Date.now() + 90 * 86400_000) }))],
      skipDuplicates: true,
    });
  }
  await audit(actorId, days ? "user.suspend" : "user.ban", "User", userId, { reason, days });
}

async function removeTarget(type: string, id: string) {
  switch (type) {
    case "POST": {
      const p = await db.post.update({ where: { id }, data: { deletedAt: new Date() } });
      const media = await db.postMedia.findMany({ where: { postId: p.id } });
      await db.media.updateMany({ where: { id: { in: media.map((m) => m.mediaId) } }, data: { status: "REMOVED" } });
      break;
    }
    case "COMMENT":
      await db.postComment.update({ where: { id }, data: { deletedAt: new Date() } });
      break;
    case "ROOM_MESSAGE":
      await db.message.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
      break;
    case "PRIVATE_MESSAGE": {
      const m = await db.privateMessage.update({ where: { id: BigInt(id) }, data: { body: "[removido pela moderação]" } });
      if (m.mediaId) await db.media.update({ where: { id: m.mediaId }, data: { status: "REMOVED" } });
      break;
    }
    case "MEDIA":
      await db.media.update({ where: { id }, data: { status: "REMOVED" } });
      break;
  }
}

export async function handleReport(reportId: string, formData: FormData) {
  const staff = await requireStaff();
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r) return;
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").slice(0, 500) || null;

  if (op === "dismiss") {
    await db.report.update({ where: { id: r.id }, data: { status: "DISMISSED", resolution: note, resolvedById: staff.id, resolvedAt: new Date() } });
    // mídia bloqueada preventivamente volta ao ar
    if (r.reason === "POSSIBLE_MINOR") {
      const ev = r.evidence as { media?: string[]; mediaId?: string } | null;
      const ids = [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
      await db.media.updateMany({ where: { id: { in: ids }, status: "QUARANTINED" }, data: { status: "APPROVED" } });
    }
  } else if (op === "remove" || op === "remove_ban" || op === "remove_suspend") {
    await removeTarget(r.targetType, r.targetId);
    if (op !== "remove" && r.targetUserId) await banUser(r.targetUserId, staff.id, `Denúncia ${r.reason}`, op === "remove_suspend" ? 7 : null);
    await db.report.update({ where: { id: r.id }, data: { status: "RESOLVED", resolution: note ?? op, resolvedById: staff.id, resolvedAt: new Date() } });
  } else if (op === "escalate") {
    // CSAM / crime: preserva evidência, bloqueia hash, bane, marca para reporte às autoridades
    const ev = r.evidence as { media?: string[]; mediaId?: string } | null;
    const ids = [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
    const medias = await db.media.findMany({ where: { id: { in: ids } } });
    await db.media.updateMany({ where: { id: { in: ids } }, data: { status: "QUARANTINED" } });
    for (const m of medias) await db.mediaHashBlock.upsert({ where: { sha256: m.sha256 }, create: { sha256: m.sha256, reason: `report:${r.id}` }, update: {} });
    await removeTarget(r.targetType, r.targetId).catch(() => {});
    if (r.targetUserId) await banUser(r.targetUserId, staff.id, "Conteúdo ilegal (escalado)", null);
    await db.report.update({ where: { id: r.id }, data: { status: "ESCALATED", resolution: note, resolvedById: staff.id, resolvedAt: new Date() } });
  }
  await audit(staff.id, `report.${op}`, "Report", r.id, { note });
  revalidatePath("/admin/denuncias");
}

// ---------------- Usuários (admin) ----------------
export async function adminUserAction(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const op = String(formData.get("op"));
  if (userId === admin.id && op !== "coins") return;
  if (op === "ban") await banUser(userId, admin.id, "Banido pelo admin", null);
  else if (op === "suspend") await banUser(userId, admin.id, "Suspenso pelo admin", 7);
  else if (op === "unban") {
    const u = await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await db.banFingerprint.deleteMany({ where: { kind: "EMAIL", valueHash: sha256(u.email) } });
    await audit(admin.id, "user.unban", "User", userId);
  } else if (op === "role") {
    const role = z.enum(["USER", "MODERATOR", "ADMIN"]).parse(formData.get("role"));
    await db.user.update({ where: { id: userId }, data: { role } });
    await audit(admin.id, "user.role", "User", userId, { role });
  } else if (op === "verify") {
    await db.user.update({ where: { id: userId }, data: { ageVerification: "APPROVED", ageVerifiedAt: new Date() } });
    await audit(admin.id, "user.verify", "User", userId);
  } else if (op === "vip") {
    const days = Number(formData.get("days") || 30);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return;
    await grantVip(userId, days);
    await notify(userId, "SYSTEM", `⭐ Você ganhou ${days} dias de assinatura!`);
    await audit(admin.id, "user.vip", "User", userId, { days });
  } else if (op === "coins") {
    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") || "Ajuste manual").slice(0, 200);
    const key = String(formData.get("idem") || "");
    if (!Number.isInteger(amount) || amount === 0 || !key) return;
    await adminAdjust(userId, amount, admin.id, note, `admin:${key}`);
    if (amount > 0) await notify(userId, "COINS_CREDITED", `+${amount} ${CURRENCY_NAME} creditadas pela administração (${note})`);
  }
  revalidatePath("/admin/usuarios");
}

// ---------------- Salas (admin) ----------------
export async function adminRoomAction(roomId: string, formData: FormData) {
  const admin = await requireAdmin();
  const op = String(formData.get("op"));
  if (op === "official") {
    const r = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    await db.room.update({ where: { id: roomId }, data: { isOfficial: !r.isOfficial } });
  } else if (op === "delete") {
    await db.room.delete({ where: { id: roomId } });
  }
  await audit(admin.id, `room.admin.${op}`, "Room", roomId);
  revalidatePath("/admin/salas");
}

// ---------------- Loja (admin) ----------------
const itemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().min(2).max(80),
  description: z.string().max(255).optional(),
  category: z.enum(Object.keys(itemConfigSchemas) as [ItemCategoryKey, ...ItemCategoryKey[]]),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "LIMITED"]),
  config: z.string(),
  powerScore: z.coerce.number().int().min(0).max(1000),
  price7: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  price30: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  pricePerm: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  limitedQty: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
});

export async function saveItem(_: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const admin = await requireAdmin();
  const p = itemSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: `${p.error.issues[0].path.join(".")}: ${p.error.issues[0].message}` };
  let cfg: unknown;
  try {
    cfg = JSON.parse(p.data.config);
  } catch {
    return { error: "Config não é JSON válido" };
  }
  const c = itemConfigSchemas[p.data.category].safeParse(cfg);
  if (!c.success) return { error: `Config inválida para ${p.data.category}: ${c.error.issues[0].path.join(".")} ${c.error.issues[0].message}` };
  const data = {
    name: p.data.name,
    description: p.data.description || null,
    category: p.data.category,
    rarity: p.data.rarity,
    config: c.data,
    powerScore: p.data.powerScore,
    price7: p.data.price7 ?? null,
    price30: p.data.price30 ?? null,
    pricePerm: p.data.pricePerm ?? null,
    limitedQty: p.data.limitedQty ?? null,
  };
  await db.item.upsert({ where: { slug: p.data.slug }, create: { slug: p.data.slug, ...data }, update: data });
  await audit(admin.id, "item.save", "Item", p.data.slug);
  revalidatePath("/admin/loja");
  return { ok: true };
}

export async function toggleItemActive(itemId: string) {
  const admin = await requireAdmin();
  const i = await db.item.findUniqueOrThrow({ where: { id: itemId } });
  await db.item.update({ where: { id: itemId }, data: { active: !i.active } });
  await audit(admin.id, "item.toggle", "Item", itemId);
  revalidatePath("/admin/loja");
}

export async function savePackage(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").slice(0, 60),
    coins: Number(formData.get("coins")),
    bonusCoins: Number(formData.get("bonusCoins") || 0),
    priceCents: Math.round(Number(String(formData.get("price")).replace(",", ".")) * 100),
    active: formData.get("active") === "on",
  };
  if (!data.name || !Number.isInteger(data.coins) || data.coins <= 0 || !Number.isFinite(data.priceCents) || data.priceCents <= 0) return;
  if (id) await db.coinPackage.update({ where: { id }, data });
  else await db.coinPackage.create({ data });
  await audit(admin.id, "package.save", "CoinPackage", id || data.name);
  revalidatePath("/admin/loja");
}

// ---------------- Anúncios (admin) ----------------
export async function createAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  const body = String(formData.get("body") || "").trim().slice(0, 500);
  const hours = Number(formData.get("hours") || 24);
  if (!body) return;
  await db.announcement.create({ data: { body, expiresAt: new Date(Date.now() + hours * 3600_000) } });
  if (formData.get("rooms") === "on") {
    const rooms = await db.room.findMany({ select: { id: true } });
    await db.message.createMany({ data: rooms.map((r) => ({ roomId: r.id, kind: "ANNOUNCEMENT" as const, body })) });
  }
  await audit(admin.id, "announcement.create", undefined, undefined, { body });
  revalidatePath("/admin/avisos");
}

export async function endAnnouncement(id: string) {
  await requireAdmin();
  await db.announcement.update({ where: { id }, data: { expiresAt: new Date() } });
  revalidatePath("/admin/avisos");
}

export async function saveVipPlan(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").slice(0, 60),
    days: Number(formData.get("days")),
    bonusCoins: Number(formData.get("bonusCoins") || 0),
    priceCents: Math.round(Number(String(formData.get("price")).replace(",", ".")) * 100),
    active: formData.get("active") === "on",
  };
  if (!data.name || !Number.isInteger(data.days) || data.days <= 0 || !Number.isFinite(data.priceCents) || data.priceCents <= 0) return;
  if (id) await db.vipPlan.update({ where: { id }, data });
  else await db.vipPlan.create({ data });
  await audit(admin.id, "vipplan.save", "VipPlan", id || data.name);
  revalidatePath("/admin/loja");
}
